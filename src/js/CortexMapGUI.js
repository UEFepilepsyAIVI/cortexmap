/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/

const cortexMapCore = require('./CortexMapCore.js');

const colorPicker = require('bootstrap-colorpicker');
const JSZip = require("jszip");
const PDFDocument = require('pdfkit');
const blobStream  = require('blob-stream');
const SVGtoPDF = require('svg-to-pdfkit');

var cortexMapGUI = (function(){
'use strict';


	const CONTROL_HEIGHT = 34;
	const RESULT_IMAGE_DPI = 300;
	const ADDITIONAL_INPUT_PADDING = 15;

	const DEFAULT_SLICE_DEPTH = 0; 
	const SLICE_DEPTH_RANGE=[0,1];
	const DEFAULT_SPLINE_ALPHA = 0.5;
	const SPLINE_ALPHA_RANGE = [0,1];	
	const DEFAULT_SPLINE_RESOLUTION = 10;
	const SPLINE_RESOLUTION_RANGE =[10,100];		
	const DEFAULT_BORDER_STYLE = 'solid';

	const DEFAULT_ANIMATION_DURATION = 400;
	const FAST_ANIMATION_DURATION = 200;
	const SLOW_ANIMATION_DURATION = 600;

	const FILE_NAME_COLUMN = 0;
	const TIME_COLUMN = 1;
	const TYPE_COLUMN = 2;

	const ELECTRODE_TYPE = "Elect.";
	const ELECTORE_LABEL_OFFSET = 2;

	var LESION_TABLE_HEADER = ['Bregma','M1','M2','M3'];
	var ELECTRODE_TABLE_HEADER = ['Bregma','M1','M2','Channel'];

	const VIDEO_BUFFER_RENDER_INTERVAL = 10;
	const VIDEO_ENCODE_INTERVAL = 20;

	const IMAGE_ZIP_FILE_NAME = "cortexmap_images.zip";
	const LESION_ANIMATION_FILE_NAME = "cortexmap_lesion_animation.webm";

	var fill_color = "rgba(0, 0, 255, 0.5)";
	var border_color = "rgba(0, 0, 255, 1)";
	var electrode_color = "rgba(3, 80, 150,1)"
	var animationSpeed = 1.0;
	var debugMode = false;

	var templateSVG;
	var currentKey;

	var mouseX;
	var mouseY;

	var measurementDataTable;
	var lesionDataMap = {};
	
	let previousLesion = null;
	let displayedLesionPolygon;
	var electrodeElements = [];	

	class ProgressModal {

		constructor() {
			this.current = 0;
			this.label = ""
			this.modal = null;
			this.bar = null;
			this.max = 0;
		}

		init() {

			$('.modalProgressBar').modal({
				backdrop: "static",
				show: false
			});

			this.modal = $('.modalProgressBar'),
			this.bar = this.modal.find('.progress-bar');
		};

		show(value, label="") {

			this.max = value;
			this.curret = 0;
			this.label = label;

			this.modal.modal('show');
			this.bar.addClass('animate');	
			$("#loadingBarLabel").empty();

			var textNode = document.createTextNode(label);
			$("#loadingBarLabel").append(textNode);		
		}

		hide() {

			this.bar.removeClass('animate');
			this.modal.modal('hide');
			this.current = 0;

			this.bar.css("width", 0 + "%")
			.attr("aria-valuenow", 0)
			.text(0 + "% Complete");			
		}

		progress(amount) {

			this.current += amount;	
			let current_progress = Math.round((this.current / this.max)*100);

			current_progress = Math.min(100, current_progress);
			this.bar.css("width", current_progress + "%")
			.attr("aria-valuenow", current_progress)
			.text(current_progress + "%");
		}
	}


	function getCurrentFillColor() {
		return window.CortexMapOverrides && window.CortexMapOverrides.fillColor ? CortexMapOverrides.fillColor : fill_color;
	}

	function getCurrentBorderColor() {
		return window.CortexMapOverrides && window.CortexMapOverrides.borderColor ? CortexMapOverrides.borderColor : border_color;
	}

	function getCurrentElectrodeColor() {
		return window.CortexMapOverrides && window.CortexMapOverrides.electrodeColor ? CortexMapOverrides.electrodeColor : electrode_color;
	}

	function getCurrentBorderWidth() {
		return window.CortexMapOverrides && window.CortexMapOverrides.borderWidth ? CortexMapOverrides.borderWidth : $("#borderWidthInput").val();
	}	
	
	function getCurrentElectrodeRadius() {
		return window.CortexMapOverrides && window.CortexMapOverrides.electrodeRadius ? CortexMapOverrides.elecetrodeRadius : $("#electrodeRadiusInput").val();
	}	

	function getCurrentElectrodeLabelSize() {
		return window.CortexMapOverrides && window.CortexMapOverrides.electrodeLabelSize ? CortexMapOverrides.electrodeLabelSize : $("#electrodeLabelSizeInput").val();
	}		

	function getCurrentBorderStyle() {
		return window.CortexMapOverrides && window.CortexMapOverrides.borderStyle ? CortexMapOverrides.borderStyle : $(".selectpicker").val();
	}	

	function getCurrentDPI() {
		return window.CortexMapOverrides && window.CortexMapOverrides.dpi ? CortexMapOverrides.dpi : $("#dpiInput").val();
	}
	/**
	 * Renders a given lesion into a new SVG element
	 */
	function renderLesion( lesionData ) {

		let div = $('<div>');
		div.append(cortexMapCore.getTemplateSVG());
		let svg = Snap(div.children()[0]);


		let points = lesionData.lesionPolygon.reduce( (a,b)=>{ return a.concat(b); });

		let polygon = null;
		if ( !lesionData.isElectrode ) {
			polygon = svg.polygon(points).attr({ fill: fill_color, stroke: { width: 1, color : border_color, id: "lesion" },opacity: 1});		 
			setLesionStyleProperties(polygon);
		}

		return [div.children()[0],polygon,svg];
	}

	/*
	Morphs displayed lesion to another lesion
	*/ 
	function morphLesion(lesionElement,fromPoints, toPoints, duration) {

		var interpolator = flubber.interpolate(fromPoints, toPoints);
	
		let microsecondCount = 0;
	
		window.requestAnimationFrame(draw);			
	
		function draw(time) {
			microsecondCount += time;
			let t = microsecondCount / duration;
	
			lesionElement.setAttribute( "points", pathToAbsolute( interpolator(t)).reduce( (a,b)=> { return a.concat(b); }) );
	
			if ( t < 1.0 ) {
				window.requestAnimationFrame(draw);
			}
			else {
				displayedLesionPolygon.remove();
				let points = toPoints.reduce( (a,b)=>{ return a.concat(b); });
				displayedLesionPolygon = templateSVG.polygon(points).attr({ 
																	"pointer-events" : "none",
																	fill: fill_color, 
																	stroke: { width: 1, color : border_color, id: "lesion" },
																	opacity: 1
																});
				setLesionStyleProperties(displayedLesionPolygon);
			}
	
		}
		
	}	

	/*
	Displays the given lesion on the cortex map. If no lesion is currently displayed, the new lesion will fade in.
	If a lesion is already displayed, the previous lesion will be morphed to the given lesion.
	*/
	function displayLesion(currentLesionData) {
	 
		let points = currentLesionData.lesionPolygon.reduce( (a,b)=>{ return a.concat(b); });

		if (previousLesion == null ) {
			previousLesion = currentLesionData;
		}

		let electrodeData = getElectrodeData();

		if ( electrodeData.length > 0 
			&& electrodeData[0][1] <= currentLesionData.time
				) {

			if ( electrodeElements.length == 0 ) {
				drawElectrodes(true,templateSVG,true);
			}	
		}
		else {
			removeElectrodes();
		}

		if ( currentLesionData.isElectrode ) {
			return;
		}
		//If a lesion is already displayed, morhp the lesion into the given lesion
		if ( displayedLesionPolygon ) {
			morphLesion(displayedLesionPolygon.node,previousLesion.lesionPolygon, currentLesionData.lesionPolygon,1000000);
		}
		else {			
			displayedLesionPolygon = templateSVG.polygon(points).attr(
																{ 
																	fill: fill_color, 
																	"pointer-events" : "none",
																	stroke: { width: 1, color : border_color, id: "lesion" }
																	,opacity: 1
																}
																);
			displayedLesionPolygon.node.id = 'lesion';
			setTimeout(function(){displayedLesionPolygon.animate({opacity:"1"},500)},0);	

		}

		setLesionStyleProperties(displayedLesionPolygon);
		showRatios(currentLesionData);
		previousLesion = currentLesionData;
	}

	/*
	Draw the electrode positions to the current template.
	*/
	function drawElectrodes(animate,svg,insert=true) {

		let electrodeData = getElectrodeData();
		let electrodeCoordinates = lesionDataMap[electrodeData[0][0]].lesionPolygon;
		let labels = lesionDataMap[electrodeData[0][0]].labels;
		let electrodeRadius =  $("#electrodeRadiusInput").val();
		let electrodeLabelFontSize = $("#electrodeLabelSizeInput").val();

		electrodeCoordinates.slice(0,Math.round(electrodeCoordinates.length/2)).forEach( (coordinates, index) => {
			
			let circle = svg.circle(coordinates[0], coordinates[1], electrodeRadius).attr( { "pointer-events":"none", "fill" : electrode_color, "opacity":"0"});
			let label = svg.text(
								coordinates[0], 
								coordinates[1] - electrodeRadius - ELECTORE_LABEL_OFFSET,
								coordinates[2]).attr( { 
														"pointer-events":"none", 
														"text-anchor":"middle", 
														"fill" : electrode_color, 
														"opacity":"0",
														"font-family":"Arial",
														"font-size":electrodeLabelFontSize,
														"paint-order": "stroke"
														});
			if ( animate ) {
				setTimeout(function(){circle.animate({opacity:"1"},300 )},index*100);
				setTimeout(function(){label.animate({opacity:"1"},300)},index*100);	
			}
			else {
				circle.attr( { "opacity": "1"});
				label.attr( {"opacity" : "1"});
			}
			if ( insert ) {
				electrodeElements.push([circle,label]);
			}

		})
	}	
	//Remove electrodes position markers and the associated labels from the map
	function removeElectrodes() {
		electrodeElements.forEach( electrodeEntry => {
			electrodeEntry[0].remove();
			electrodeEntry[1].remove();
		});
		electrodeElements = [];

    }	
	//Repaints the currently displayed lesion contour using updated lesion graphics settings
	function updateContour() {
		if (displayedLesionPolygon) {
			setLesionStyleProperties(displayedLesionPolygon);
		}

		if ( electrodeElements.length > 0 ) {
			removeElectrodes();
			drawElectrodes(false,templateSVG);
		}
	}	

	//Removes the displayed lesion
	function clearMap() {

		if ( displayedLesionPolygon) {
			displayedLesionPolygon.remove();
			displayedLesionPolygon = null;
		}

		resizeUI();	
	}

	//Sets the properties of a given lesion to match the current lesion
	//style setttigns.
	function setLesionStyleProperties(lesionPolygon){

		let currentBorderWidth = getCurrentBorderWidth();
		let currentBorderStyle = getCurrentBorderStyle();
		lesionPolygon.attr('stroke-width', currentBorderWidth);
		lesionPolygon.attr('stroke', getCurrentBorderColor());			

		if (currentBorderStyle == 'solid') {
			lesionPolygon.attr('stroke-dasharray', []);		
		}
		if (currentBorderStyle == 'dashed') {
			lesionPolygon.attr('stroke-dasharray', [currentBorderWidth*5, currentBorderWidth*2]);			
		}
		if (currentBorderStyle == 'dotted') {
			lesionPolygon.attr('stroke-dasharray', [currentBorderWidth, currentBorderWidth]);			
		}
		lesionPolygon.attr('fill', getCurrentFillColor());	
	}	

	function handleAnimalOverride() {
		if ( window.CortexMapOverrides && window.CortexMapOverrides.animal ) {
			changeAnimal(window.CortexMapOverrides.animal);
		}
	}

	//Returns the entry corresponding to electrode data from the datatable.
	function getElectrodeData() {

		var indexes = measurementDataTable.rows().eq( 0 ).filter( function (rowIdx) {
			return measurementDataTable.cell( rowIdx, TYPE_COLUMN ).data() == ELECTRODE_TYPE ? true : false;
		} );

		return measurementDataTable.rows(indexes).data();
	}

	function getNLeasionEntries() {
		var indexes = getLesionIndexes();
		return measurementDataTable.rows(indexes).count();
	}

	//Returns the indexes of rows corresponding to lesion entries in the data table.
	function getLesionIndexes() {
		var rowIndexes = [];
		let orderedDataTable = measurementDataTable.rows({ order: 'applied' }); 

		let i = 0;
		orderedDataTable.rows( function ( idx, data, node ) {           
				 if(data[TYPE_COLUMN] != ELECTRODE_TYPE){
					rowIndexes.push(i);                  
				 }
				 i++;  
				 return false;
			 }); 
		return rowIndexes;
	}

	//Display the table presenting the ratios of areas affected.
	function showRatios(key) {

		swapRatios(key);
		toggleRatios('show')

	}

	//Togges the visibility of the table listing the imported measurements.
	function toggleMeasurementTable(visible){
		if ( visible == 'show') {

			if ( getNLeasionEntries() > 0 ) {
				$("#resultsDiv").css('visibility','visible').hide().fadeIn(FAST_ANIMATION_DURATION*animationSpeed);
				$("#saveTable").css('visibility','visible').hide().fadeIn(FAST_ANIMATION_DURATION*animationSpeed);

			}
			$("#dataDiv").collapse("show");
			$("#removeMeasurement").css('visibility','visible').hide();
			$("#saveImage").css('visibility','visible').hide().fadeIn(FAST_ANIMATION_DURATION*animationSpeed);
		}
		else {
			$("#resultsDiv").hide(FAST_ANIMATION_DURATION*animationSpeed);
			$("#dataDiv").collapse("hide");
			$("#saveTable").hide(FAST_ANIMATION_DURATION*animationSpeed);
			$("#saveImage").hide(FAST_ANIMATION_DURATION*animationSpeed);
			$('#removeMeasurement').hide('fade', FAST_ANIMATION_DURATION*animationSpeed);
		}
	}

	function CanvasVideoRecorder(canvas, video_bits_per_sec=10*2500000 , fps=60) {

		this.start = startRecording;
		this.stop = stopRecording;
		this.save = getVideo;
		this.getSupportedType = getSupportedType;
		
		var recordedBlobs = [];
		var videoBuffer = [];
		var supportedType = null;
		var mediaRecorder = null;
		var stream;
		var stopCallback = null;

		function getSupportedType() {

			let types = [
				"video/webm",
				'video/webm,codecs=vp9',
				'video/vp8',
				"video/webm\;codecs=vp8",
				"video/webm\;codecs=daala",
				"video/webm\;codecs=h264",
				"video/mpeg"
			];

			for (let i in types) {
				if (MediaRecorder.isTypeSupported(types[i])) {
					return supportedType = types[i];
				}
			}

			return null;
		}
	
		function startRecording() {

			stream = canvas.captureStream(fps);

			supportedType = getSupportedType();

			if (supportedType == null) {
				console.log("No supported type found for MediaRecorder");
			}
			let options = { 
				mimeType: supportedType,
				videoBitsPerSecond: video_bits_per_sec
			};
	
			recordedBlobs = [];
			try {
				mediaRecorder = new MediaRecorder(stream, options);
			} catch (e) {
				console.error('MediaRecorder initialization exception:', e);
				return;
			}
	
			mediaRecorder.onstop = handleStop;
			mediaRecorder.ondataavailable = handleDataAvailable;
			mediaRecorder.start(1.0/fps);

		}
	
		function handleDataAvailable(event) {	
			if (event.data && event.data.size > 0) {

				recordedBlobs.push(event.data);
			}
		}
	
		function handleStop(event) {
			videoBuffer = new Blob(recordedBlobs, { type: supportedType });
			stopCallback(videoBuffer)
		}
	
		function stopRecording(callback) {
			stopCallback = callback;
			mediaRecorder.stop();
		}
	
		function getVideo() {
			const blob = new Blob(recordedBlobs, { type: supportedType });
			return blob;
		}
	}

	//Creates a WebM video
	function createLesionProgressionVideo(lesionDataMap, videHeight=1080, transitionDuration=500) {

		//Display progress modal
		var loadingModal = new ProgressModal();
		loadingModal.init();
		loadingModal.show((measurementDataTable.rows().count()-1)*2, "Encoding video...");

		return new Promise( (resolve, reject) => { 
	
			const measurementData = measurementDataTable.rows({ order: 'applied' }).data();

			var animationCanvas = document.createElement('canvas');
			animationCanvas.height = videHeight;
			animationCanvas.width = animationCanvas.height * (cortexMapCore.getTemplateSVG()[2].getAttribute("width")/cortexMapCore.getTemplateSVG()[2].getAttribute("height") ) 

			let ctx = animationCanvas.getContext("2d");
			ctx.beginPath();
			ctx.rect(0, 0, animationCanvas.width , animationCanvas.height);
			ctx.fillStyle = "white";
			ctx.fill();

			const recorder = new CanvasVideoRecorder(animationCanvas);

			let lesionIndexes = getLesionIndexes();
			let electrodeData = getElectrodeData();
			let currentLesionData = lesionDataMap[measurementData[lesionIndexes[0]][0]]; 

			let lesionSVG = renderLesion(currentLesionData)
			
			let blobs = []

			loadingModal.progress(1);

			function drawLesionFrames() {

				let i = 0;
				let start = 0;
				let duration = transitionDuration;
				var interpolator = flubber.interpolate(lesionDataMap[measurementData[lesionIndexes[i]][0]].lesionPolygon, lesionDataMap[measurementData[lesionIndexes[i+1]][0]].lesionPolygon);				
				i++;		
				let electrodesInserted = false;	
				function doRendering(time) {
					let deltaTime = ( measurementData[lesionIndexes[i]][1] - measurementData[lesionIndexes[i-1]][1]);
					start += time;
					let t = start / (duration*deltaTime);

					lesionSVG[1].node.setAttribute( "points", pathToAbsolute( interpolator(t)).reduce( (a,b)=> { return a.concat(b); }) );
					let timePoint;

					if ( i == lesionIndexes.length ) {
						timePoint = measurementData[lesionIndexes[i-1]][1];
					}
					else {
						timePoint = measurementData[lesionIndexes[i-1]][1] + Math.round( deltaTime*t );
					}	
					
					if ( electrodeData.length > 0 
						&& electrodeData[0][1] <= timePoint
						) {
			
						if ( !electrodesInserted ) {
							electrodesInserted = insertElectrodes(lesionSVG[2],timePoint);
						}	
					}
					cortexMapCore.paintMapToCanvas(animationCanvas, 
						lesionSVG[0], 
						cortexMapCore.getTemplateSVG()[2].getAttribute("width"),
						cortexMapCore.getTemplateSVG()[2].getAttribute("height"),
						function(animationCanvas) {

							animationCanvas.toBlob(function(blob){ 
								blobs.push(blob);
								if (t >= 1.0 && i == lesionIndexes.length-1) {
									loadingModal.progress(1);
									renderFrames();
								}
								else {
									if (t>=1.0 ) {
										loadingModal.progress(1);
										start = 0;
										lesionSVG = renderLesion(lesionDataMap[measurementData[lesionIndexes[i]][0]]);
										interpolator = flubber.interpolate(lesionDataMap[measurementData[lesionIndexes[i]][0]].lesionPolygon, lesionDataMap[measurementData[lesionIndexes[i+1]][0]].lesionPolygon);
										i++;
									}

									setTimeout( ()=> {doRendering(10)}, 4);
								} 
							}, 'image/jpeg', 1.0);	
						},
						false,
						timePoint);		
				}

				function renderFrames() {
					let i = 0;			
					let increment = measurementData.length / (blobs.length-1); 

					function drawBlobs() {
						let img = new Image();
						img.addEventListener('load', function () {
							animationCanvas.getContext("2d").drawImage(img, 0, 0);
							if ( i < blobs.length-1 ) {
								i++;

								loadingModal.progress(increment);				
								setTimeout( ()=> {drawBlobs()}, 4);	
							}
							else {
								
								loadingModal.hide();
								recorder.stop(()=> {resolve( recorder.save())});
							}
						}, false);

						img.src = URL.createObjectURL(blobs[i]);

					}

					setTimeout( ()=> {drawBlobs()}, 4);								
					recorder.start();

				}
				setTimeout( ()=> {doRendering(20)}, 4);	
			}		
			drawLesionFrames();

		});

	}		
	//Toggles the visibility of the ratio table
	function toggleRatios(visible) {
		if ( visible == 'show') {
			if ( $("#resultsDiv").is(":hidden") ) {
				$("#resultsDiv").css('visibility','visible').hide().fadeIn(FAST_ANIMATION_DURATION*animationSpeed);
			}
			if ( $("#chartsDiv").is(":hidden") ) {
				$("#chartsDiv").css('visibility','visible').hide().fadeIn(FAST_ANIMATION_DURATION*animationSpeed);
			}
			if ( $("#saveVideo").is(":hidden") && measurementDataTable.rows().count() > 1) {
				$("#saveVideo").css('visibility','visible').hide().fadeIn(FAST_ANIMATION_DURATION*animationSpeed);
			}

			if ( getNLeasionEntries() > 1 ) {
				displayAreaChart();
			}
			else {
				$('#chartsDiv').css('visibility','visible').hide();
			}
		}
		else {
			$("#resultsDiv").css('visibility','visible').hide();
			$('#chartsDiv').css('visibility','visible').hide();
			$("#saveVideo").hide();	
		}
	}

	//Fades out the currently displayed rations and fades in the ratios of the given lesion
	function swapRatios(newLesion) {
		$("#ratioDiv").fadeOut(FAST_ANIMATION_DURATION*animationSpeed, function() {
			$("#ratioDiv").empty();
			var table = makeTable(newLesion.ratiosFiltered,'ratioTable',['Area','%','mm<sup>2</sup>'], true);
			$("#ratioDiv").append(table);
			$("#ratioDiv").fadeIn(FAST_ANIMATION_DURATION*animationSpeed)
		})
	}

	//Creates a table with the given id based on the data and header provided
	function makeTable(data, id, headers, horizontal=false) {

		if ( horizontal) {
			var html = '<table class="table" id="' + id +'">';
			//For each row in table
			for (var i = 0, rowLen = data[0].length; i < rowLen; ++i ) {
				html += '<tr>';			
				html += '<th>' + headers[i] + '</th>';
				for (var j = 0, len = data.length; j < len; ++j) {
					
					html += '<td>' + data[j][i] + '</td>';
					
	
				}
				html += "</tr>";
			}
			html += '</table>';			
		}
		else {
			var html = '<table class="table" id="' + id +'">';
			html += '<thead><tr>';
			for (var h = 0; h < headers.length; h++ ) {
				html += '<th>' + headers[h] + '</th>';
			}
	
			html += '</thead><tbody>';
			for (var i = 0, len = data.length; i < len; ++i) {
				html += '<tr>';
				for (var j = 0, rowLen = data[i].length; j < rowLen; ++j ) {
				html += '<td>' + data[i][j] + '</td>';
				}
				html += "</tr>";
			}
			html += '</tbody><tfoot><tr></tr></tfoot></table>';
		}

		return html;
	}


	//Displays the import modal
	function showImportModal(importedCoordinates,fileName,format) {

		//Reset additional inputs
		$("#typeInputRow").removeClass("hidden");	
		$("#depthInputRow").removeClass("hidden");		
		$("#contourInputRow").removeClass("hidden");		
		$("#contourInputButtonRow").removeClass("hidden");
		
		if ( !$( "#depthInputRow" ).hasClass('collapse in') ) {
			$("#depthInputRow" ).collapse('hide');
			$("#labelStained").button('toggle');
		}
		if ( $( "#contourInputRow" ).hasClass('collapse in') ) {
			$("#contourInputRow" ).collapse('hide');
			$("#labelLinear").button('toggle');
		}


		var tableHeader = LESION_TABLE_HEADER;

		if ( format === "electrode") {

			$("#typeInputRow").addClass("hidden");	
			$("#depthInputRow").addClass("hidden");		
			$("#contourInputRow").addClass("hidden");		
			$("#contourInputButtonRow").addClass("hidden");
			tableHeader = ELECTRODE_TABLE_HEADER;				
		}		

		var table = makeTable(importedCoordinates,'Coordinates',tableHeader);

		
		$("#importedCoordinatesDiv").empty();
		$("#importedCoordinatesDiv").append(table);

		//Error state should be resetted for each import
		resetInputError("#depthInput");
		resetInputError("#splineAlphaInput");	
		resetInputError("#resolutionInput");

		$("#depthInput").val(DEFAULT_SLICE_DEPTH);
		$("#splineAlphaInput").val(DEFAULT_SPLINE_ALPHA);
		$("#resolutionInput").val(DEFAULT_SPLINE_RESOLUTION);
		$('#importModal').modal();  
		$('#importCoordinatesButton').unbind('click'); 
		$('#importCoordinatesButton').bind('click',function() { importCoordinates(importedCoordinates, fileName, format);});  
	}

	//Displays the import modal
	function importCoordinates(importedCoordinates,fileName,format) {

		var sliceDepth = parseFloat($("#depthInput").val());
		let time = $("#timeInput").val();
		let labels = null;

		if ( !isValidInputValue(sliceDepth,SLICE_DEPTH_RANGE[0],SLICE_DEPTH_RANGE[1]) ) {
			validateInput("#depthInput", SLICE_DEPTH_RANGE);
		}
		else if ( valueImported(time, TIME_COLUMN) || isNaN(time) ) {
			$("#timeInput"+"Group").addClass("has-error");
			$("#timeInput"+"GlyphIcon").removeClass("hidden");
		}
		else {
			var interpolationSettings = null;
			if ($('#inputSpline').is(':checked') ) { 
				interpolationSettings = {};
				interpolationSettings.splineAlpha = parseFloat($("#splineAlphaInput").val());
				interpolationSettings.splineResolution = parseFloat($("#resolutionInput").val());
			}
			$('#importModal').modal('hide'); 
			$(document).trigger('loader:show');

			var analysisFinishedCallback = function(results) {

				results.ratiosFiltered = results.ratios.filter( (row)=> { return row[1] > 0 }); 

				results.ratiosMap = new Map( results.ratiosFiltered.map( (row) => { return [ row[0], [row[1], row[2] ] ]} ));
				results.isElectrode = format == "electrode";

				if ( results.isElectrode ) {
					results.ratiosFiltered = [];
					results.ratiosMap = new Map();
				}

	
				//Add the imported lesion to the list of imported lesions.
				let time = parseInt($("#timeInput").val());
				let type = $("#inputTypeRadioButtons input:radio:checked").val();

				if ( format == "electrode") {
					type = ELECTRODE_TYPE;
					results.labels = labels;
				}
				results.time = time;
				//measurementDataTable =  $('#measurementDataTable').DataTable();
				measurementDataTable.row.add( [fileName, time, type]).draw();
				if ( format != "electrode") {
					results.lesionPolygon = results.lesionPolygon.map( x => { return [x[0], x[1]]});
				}
				
				//Add the mapped lesion to data map
				lesionDataMap[fileName] = results;

				
	
				currentKey = fileName;
	
				$(document).trigger( "loader:hide");
				let currentLesion = lesionDataMap[currentKey];
				displayLesion(currentLesion);
				showRatios(currentLesion);
				toggleMeasurementTable('show');


			};
			if ( format === "electrode") {
				labels = importedCoordinates.map( l => { return l[3]});	
				importedCoordinates = importedCoordinates.map((x)=> {return [x[0],x[1],0,x[2],x[3]]})		
			}
			else {
				importedCoordinates = importedCoordinates.map((x)=> {return [x[0],x[1],x[2],x[3],""]})	
			}



			//Check if the app is run e.g. within a headless browser and the current animal has been overriden.
			handleAnimalOverride();
			cortexMapCore.performMapping( importedCoordinates, interpolationSettings, sliceDepth,  analysisFinishedCallback);
		}
	}


	function pathToAbsolute(relativePath) {
		var pattern = /([ml])\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)/ig,
			coords = [];
	  
		relativePath.replace(pattern, function (match, command, x, y) {
		  var prev;
	  
		  x = parseFloat(x);
		  y = parseFloat(y);
	  
		  if(coords.length === 0 || command.toUpperCase() === command) {
			coords.push([x, y]);
		  } else {
			prev = coords[coords.length-1];
			coords.push([x + prev[0], y + prev[1]]);
		  }
		});
	  
		return coords;
	  }
	

	//Opens a file selector
	function selectFile(){

		//Callback for file selection
		function respondToFileSelection(evt){

			//Display the loading animation
			$(document).trigger('loader:show');

			   var file = evt.target.files[0];
			   let fileName = file.name.replace(/\.[^/.]+$/, "");
			   if ( valueImported(fileName, FILE_NAME_COLUMN) ) {
					showErrorMessage("File already imported: " + file.name);
					$(document).trigger( "loader:hide");
					return;
			   }

			var importFinishedCallback = function (specified_coordinates, format) {

				$(document).trigger( "loader:hide");
				if ( specified_coordinates != null )  {
					showImportModal(specified_coordinates, fileName, format);
				}
				else {
					showErrorMessage("Invalid input format.");
				}
			};
			$("#tmp").empty();	
			cortexMapCore.importData(file,importFinishedCallback);

		}

		var fileSelector = $('<input type="file" value=null accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.ms-excel">');
		$("#tmp").append(fileSelector);		
		fileSelector.on("change",respondToFileSelection);
		fileSelector.click();

		return false;
	}

	//Creates a 2D array presenting combined ratios and areas from multiple timepoints
	function createCombinedTable() {

		var combinedTable = [];

		let combinedMeasurements = getCombinedMeasurements();
	
		//Create header
		let header = ['Area'];

		combinedMeasurements.measurements[0].time.forEach( (t)=> {  header.push( "%_" +t); header.push("mm_" + t);});
		combinedTable.push(header);


		let totalAreaMeasurements;
		for ( let i = 0; i < combinedMeasurements.measurements.length; i++) {

			let areaMeasurements = combinedMeasurements.measurements[i];

			if ( areaMeasurements.area == "Total" ) {
				totalAreaMeasurements = areaMeasurements;
				continue;
			}

			processAreaMeasurements(areaMeasurements);
		}


		function processAreaMeasurements(areaMeasurements) {
			let row = [areaMeasurements.area]
			for ( let t = 0; t < areaMeasurements.values.length; t++) {
				if ( areaMeasurements.values[t].value  ) {
					row.push( areaMeasurements.values[t].value )
					row.push( areaMeasurements.values[t].mm )
				}
				else {
					row.push(0);
					row.push(0);				
				}

			}
			combinedTable.push(row);
		}

		processAreaMeasurements(totalAreaMeasurements);

		return combinedTable;
	}

	//Opens a download dialog for the ratios table
	function downloadTable() {
		
		var csvContent = null;

		if ( measurementDataTable.rows().count() > 1 ) {
			csvContent = tableToCSV(createCombinedTable());
		}
		else {
			csvContent = tableToCSV(lesionDataMap[currentKey].ratios,['area', '%','mm']);
		}

		var fileName = 'areas';
		
		if(isIE()){
			window.navigator.msSaveOrOpenBlob(new Blob( [csvContent],{type: "text/csv;charset=utf-8;"}), fileName+".csv");
		} else {
			var encodedUri = encodeURI(csvContent);
			var link = document.createElement("a");
			link.href = encodedUri;
			link.style = "visibility:hidden";
			link.download = fileName + ".csv";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);						
		}		
	}

	//Opens a download dialog for the ratios table
	function downloadMeasurements() {

		let currentLesionData = lesionDataMap[currentKey]; 

		var csvContent = tableToCSV(currentLesionData.measurementTable);

		var fileName = 'measurements';
		
		if(isIE()){
			window.navigator.msSaveOrOpenBlob(new Blob( [csvContent],{type: "text/csv;charset=utf-8;"}), fileName+".csv");
		} else {
			var encodedUri = encodeURI(csvContent);
			var link = document.createElement("a");
			link.href = encodedUri;
			link.style = "visibility:hidden";
			link.download = fileName + ".csv";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
								
		}		
		
	}
	
	//Check whether or not the users browser is IE
	function isIE() {
		var ua = window.navigator.userAgent;
	  
		var msie = ua.indexOf('MSIE ');
		if (msie > 0) {
			return true;
		}

		var trident = ua.indexOf('Trident/');
		if (trident > 0) {
			return true;
		}

		var edge = ua.indexOf('Edge/');
		if (edge > 0) {
			return true;
		}

		return false;
	}

	//Opens a "Save as" dialog for a given blob
	function saveAs(blob, fileName) {

		if (typeof navigator.msSaveOrOpenBlob !== 'undefined') {
			return navigator.msSaveOrOpenBlob(blob, fileName);
		} 
		else if (typeof navigator.msSaveBlob !== 'undefined') {
			return navigator.msSaveBlob(blob, fileName);
		} 
		else {
			var elem = window.document.createElement('a');
			elem.href = window.URL.createObjectURL(blob);
			elem.download = fileName;
			elem.style = 'display:none;opacity:0;color:transparent;';
			(document.body || document.documentElement).appendChild(elem);
			if (typeof elem.click === 'function') {
				elem.click();
			} 
			else {
				elem.target = '_blank';
				elem.dispatchEvent(new MouseEvent('click', {
			  	view: window,
			  	bubbles: true,
			  	cancelable: true
			}));
		  }
		  URL.revokeObjectURL(elem.href);
		}

	}	

	//Opens a download dialog for the lesion map image
	async function downloadImage() {

		var options = {};

		let zip = new JSZip();

		var loadingModal = new ProgressModal();
		loadingModal.init();		

		//If only single measurement is imported,
		//simply download the image
		if (measurementDataTable.rows().count()==1 ) {

			loadingModal.show(measurementDataTable.rows().count()+1, "Rendering images...");	

			var downloadImageCanvas = document.createElement('canvas');
			let fileName = measurementDataTable.rows().data()[0][0]
			let timePoint =  measurementDataTable.rows().data()[0][1];
			let svg = renderLesion(lesionDataMap[fileName]);
			let width = svg[0].getAttribute("width");
			let height = svg[0].getAttribute("height")


			insertElectrodes(svg[2],timePoint);


			const doc = new PDFDocument({
				layout: 'landspace',
				margin: 72,
				size: [height* 72/96, width* 72/96],
				dpi: getCurrentDPI()
			  });


			const stream = doc.pipe(blobStream());

			SVGtoPDF(doc, svg[0], 0, 0, {});


			doc.end();
			stream.on('finish', function() {

				const blob = stream.toBlob('application/pdf');
				zip.file( fileName+".pdf", blob, {base64: true});	
				loadingModal.progress(1);
				cortexMapCore.paintMapToCanvas(downloadImageCanvas, 
												svg[0], 
												cortexMapCore.getTemplateSVG()[2].getAttribute("width"),
												cortexMapCore.cortexMapTemplate.getTemplateSVG()[2].getAttribute("height"),
												function(downloadImageCanvas) {
								options.dpi = getCurrentDPI();
								
									CanvasToTIFF.toDataURL(downloadImageCanvas, function(url) {
			
										var idx = url.indexOf('base64,') + 'base64,'.length; 
										var content = url.substring(idx);
			
										zip.file( fileName+".tiff", content, {base64: true});
										loadingModal.progress(1);
										zip.generateAsync({type:"blob"})
										.then(function(content) {
											saveAs(content, IMAGE_ZIP_FILE_NAME);
											loadingModal.hide();
										});

									}, options);
	

								},
								true);
				});
				return;
		}

		function createLesionImages(lesionFile) {
			var downloadImageCanvas = document.createElement('canvas');
			return new Promise( (resolve, reject) => { 

					const svg = renderLesion(lesionDataMap[lesionFile]);
					const timePoint = lesionDataMap[lesionFile].time; 
					const width = svg[0].getAttribute("width");
					const height = svg[0].getAttribute("height")

					const doc = new PDFDocument({
						layout: 'landspace',
						margin: 72,
						size: [height* 72/96, width* 72/96],
						dpi: getCurrentDPI()
					  });

 
					const stream = doc.pipe(blobStream());
					insertElectrodes(svg[2],timePoint);
					SVGtoPDF(doc, svg[0], 0, 0, {});


					doc.end();
					stream.on('finish', function() {
	
						const blob = stream.toBlob('application/pdf');
						zip.file( lesionFile+".pdf", blob, {base64: true});	

						cortexMapCore.paintMapToCanvas(downloadImageCanvas, 
							svg[0], 
							cortexMapCore.getTemplateSVG()[2].getAttribute("width"),
							cortexMapCore.getTemplateSVG()[2].getAttribute("height"),
							function(downloadImageCanvas) {
							options.dpi = getCurrentDPI();
							CanvasToTIFF.toDataURL(downloadImageCanvas, function(url) {

							var idx = url.indexOf('base64,') + 'base64,'.length;
							var content = url.substring(idx);

							zip.file( lesionFile+".tiff", content, {base64: true});

							resolve()

							}, options, false);

							},
							true);
					});



			});
				
		};

		function createChartImages() {
			var downloadImageCanvas = document.createElement('canvas');			
			return new Promise( (resolve, reject) => { 

				let width = $("#chartsDiv").width();
				let height = $("#chartsDiv").height()

				const doc = new PDFDocument({
					layout: 'landspace',
					margin: 72,
					size: [height* 72/96, width* 72/96],
					dpi: getCurrentDPI()
				  });


				const stream = doc.pipe(blobStream());

				SVGtoPDF(doc, $("#chartsDiv").find('svg')[0].outerHTML, 0, 0, {width: width,height:height});

				doc.end();
				stream.on('finish', function() {

					const blob = stream.toBlob('application/pdf');
					zip.file( "chart.pdf", blob, {base64: true});	

					cortexMapCore.paintMapToCanvas(downloadImageCanvas, 
												$("#chartsDiv").find('svg')[0].outerHTML, 
												$("#chartsDiv").width(),
												$("#chartsDiv").height(),
												function(downloadImageCanvas) {
						options.dpi = getCurrentDPI();
						
						CanvasToTIFF.toDataURL(downloadImageCanvas, function(url) {

							var idx = url.indexOf('base64,') + 'base64,'.length; 
							var content = url.substring(idx);
												
							zip.file( "chart.tiff", content, {base64: true});


							resolve()

						}, options,
						);
						
					},
					true);
				});
				
			});
		}

		loadingModal.show(measurementDataTable.rows().count()+1, "Rendering images...");	

		for (var key in lesionDataMap) {
			await createLesionImages(key);
			loadingModal.progress(1);
		} 

		if ( getNLeasionEntries() > 1 ) {
			await createChartImages();	
			loadingModal.progress(1);
		}

		zip.generateAsync({type:"blob"})
		.then(function(content) {
			loadingModal.hide();
			saveAs(content, IMAGE_ZIP_FILE_NAME);
		});

	}

	async function downloadVideo() {

		if ( typeof MediaRecorder === 'undefined'|| new CanvasVideoRecorder().getSupportedType() == null ) {
			showErrorMessage("Browser does not support video encoding. Please use Chrome or Firefox instead.");
			return;
		}

		if ( measurementDataTable.data().count() > 1 ) {
			const video = await createLesionProgressionVideo(lesionDataMap);
			saveAs(video, LESION_ANIMATION_FILE_NAME);
		}
	}

	//Is the entry corresponding to a given key a lesion
	function isLesionEntry( key ) {

		let index = key;

		if (typeof(key) != "number") {
			index = measurementDataTable.column(FILE_NAME_COLUMN).data().indexOf(key);
		}
		return measurementDataTable.rows().data()[index][TYPE_COLUMN] != ELECTRODE_TYPE; 
	}

	//Remove the data corresponding to the currently selected entry in the measurement data table
	function removeMeasurement() {

		var data = measurementDataTable.rows( '.selected' ).data();

		for ( let i = 0; i < data.length; i++ ) {

			if ( data[i][TYPE_COLUMN] == ELECTRODE_TYPE) {
				removeElectrodes();
			}

			if ( currentKey === data[i][FILE_NAME_COLUMN]  ) {
				let lesionIndex = getLesionIndexes().slice(-1)[0];
				if ( getNLeasionEntries() >= 1 ) {
					currentKey = measurementDataTable.rows().data()[lesionIndex][FILE_NAME_COLUMN];
				} 
			}
		}

		measurementDataTable.rows('.selected').remove();
		measurementDataTable.draw(false);
		if (getNLeasionEntries() >= 1  ) {
			let lesionIndex = getLesionIndexes().slice(-1)[0];
			let currentLesion = lesionDataMap[measurementDataTable.rows().data()[0][FILE_NAME_COLUMN]];
			displayLesion(currentLesion);
			showRatios(currentLesion);
		}
		else {
			currentKey = null;
			toggleRatios('hide');
			toggleMeasurementTable('hide');
			clearMap(); 
		}
	}

	//Transforms the given data array into textual csv format
	function tableToCSV(data,header) {
		if ( header ) {
			data.unshift(header)
		}

		var csvContent = "data:text/csv;charset=utf-8,";
		data.forEach(function(infoArray, index){

		   var dataString = infoArray.join(",");
		   csvContent += index < data.length ? dataString+ "\r\n" : dataString;

		}); 
		return csvContent;
	}

	//Displays the settings modal
	function showSettings() {
		$('#settingsModal').modal();  

		$('#fillColorPicker').colorpicker({ color : fill_color, container: "#fillColorPicker" });
		$('#borderColorPicker').colorpicker({ color : border_color, container: "#borderColorPicker" });
		$('#electrodeColorPicker').colorpicker({ color : electrode_color, container: "#electrodeColorPicker" });		
		$('#settingsModal').unbind('hidden.bs.modal');
		$('#settingsModal').on('hidden.bs.modal', function (event) {
			var selectedFillColor = $('#fillColorPicker').data('colorpicker').color.toRGB();
			fill_color = "rgba(" + selectedFillColor.r +"," + selectedFillColor.g + "," + selectedFillColor.b +"," + selectedFillColor.a +")";
			var selectedBorderColor = $('#borderColorPicker').data('colorpicker').color.toRGB();
			border_color = "rgba(" + selectedBorderColor.r +"," + selectedBorderColor.g + "," + selectedBorderColor.b +"," + selectedBorderColor.a +")";
			var selectedElectrodeColor = $('#electrodeColorPicker').data('colorpicker').color.toRGB();
			electrode_color = "rgba(" + selectedElectrodeColor.r +"," + selectedElectrodeColor.g + "," + selectedElectrodeColor.b +"," + selectedElectrodeColor.a +")";			
			updateContour();
		});
	}

	//Displays an error message
	function showErrorMessage(message) {
		var html = "<div class='alert alert-danger fade in shadow' id='inputErrorAlert'><a href='#' class='close' data-dismiss='alert' aria-label='close'>&times;</a><strong>Error!</strong> "+message+"</div>";
		$("#alertDiv").append(html);
		$("#inputErrorAlert").fadeIn(DEFAULT_ANIMATION_DURATION*animationSpeed);
	}

	//Confirms that the given value is within the expected range
	function isValidInputValue(value, minValue, maxValue) {

		if ( isNaN(value) || value < minValue || value > maxValue ) {
			return false;
		}
		else {
			return true;
		}
	}

	//Toggles the visibility of a collapsable input row
	function toggleInputRow(inputId, resetCallback, mode, state="auto") {

		if (typeof mode === 'undefined' || mode == 'slide') {

			if ( !$( inputId ).hasClass('collapse in') && (state === "auto" || state === "show")) {
				$(inputId).collapse('show');
			}
			else {
				$(inputId).collapse('hide');
				resetCallback();	
			}
		}
		else if(mode == 'fade'){

			if ( $( inputId ).hasClass('hidden') ) {
				$(inputId).removeClass('hidden');
				$(inputId).trigger('fadeOutEvent');
			}
			else {
				$(inputId).addClass('hidden');
				resetCallback();	
				$(inputId).trigger('fadeOutEvent');
			}			
		}
	}
	
	function resetInputError(inputId) {
		$(inputId+"Group").removeClass("has-error");
		$(inputId+"GlyphIcon").addClass("hidden");
	}

	function setGUICallbacks() {
		$("#upload" ).click(selectFile);
		$("#settings").click(showSettings);
		$("#saveTable").click(downloadTable);
		$("#saveImage").click(downloadImage);
		$("#saveVideo").click(downloadVideo);
		$("#removeMeasurement").click(removeMeasurement);
	}

	function fadeOutAndSwitchContent() {

		let page = this.getAttribute("data-page");
		let callback = function() {
			
		};

		if ( page == "analyze.html" ) {
			callback = initMapping;
		}

		$('.nav-item').removeClass('active');
		$(this).parent().addClass('active');

		$("#mainUI").fadeOut(FAST_ANIMATION_DURATION*animationSpeed, function() {
			$("#mainUI").load(page, function() { 	$("#mainUI").fadeIn(FAST_ANIMATION_DURATION*animationSpeed);  callback(); } );
		});

	  	return false;			
	}

	function init() {

		//Reveal the UI
		$( "#mainNavBar" ).hide();
		$( "#mainUI" ).hide();
	
		$("#mainUI").load("analyze.html", function () { 
			initMapping();
		});

		$(".nav-link").click( fadeOutAndSwitchContent );
		$(".navbar-brand").click( fadeOutAndSwitchContent );

		$(document).mousemove( function(e) {
			// mouse coordinates
			mouseX = e.pageX; 
			mouseY = e.pageY;
		 
		 });		
	}

	//Initializes the GUI for lesion mapping
	function initMapping() {

		$( "#mainUI" ).hide();	
		
		//Initialize bootstrap tooltips
		$('[data-toggle="tooltip"]').tooltip({
			trigger : 'hover',
			delay: { "show": 500, "hide": 100 }
		});  

		//Add event listeners for hiding and displaying loading animation
		$( document).on( "loader:show", function( event ) {
			$("#loaderDiv").show();
		}).on('loader:hide', function(event) {
			$("#loaderDiv").hide();
		});
		//Add lister for the choice between stained and MRI data.
		$("#inputTypeRadioButtons :input").bind("change", function() {

			let inputId = $(this).attr('id');
	
			if ( inputId === "inputMRI") {
				$("#inputTypeRadioButtons label").css("pointer-events", "none");
				$('#depthInputRow').on("shown.bs.collapse hidden.bs.collapse", function(){
					$("#inputTypeRadioButtons label").css("pointer-events", "auto");
				});
	
				toggleInputRow("#depthInputRow", function() { resetInputError("#depthInputRow"); $("#depthInput").val(DEFAULT_SLICE_DEPTH); }, 'slide');
			}
			else {
				$('#depthInputRow').on("shown.bs.collapse hidden.bs.collapse", function(){
					$("#inputTypeRadioButtons label").css("pointer-events", "auto");
				});
				toggleInputRow("#depthInputRow", function() { resetInputError("#depthInputRow"); $("#depthInput").val(DEFAULT_SLICE_DEPTH); }, 'slide', "hide");			
			}
	
		});

		//Add lister for the choice between linear and spline contour
		$("#contourRadioButtons :input").bind("change",function() {
			$("#contourRadioButtons label").css("pointer-events", "none");

			$('#contourInputRow').on("shown.bs.collapse hidden.bs.collapse", function(){
				$("#contourRadioButtons label").css("pointer-events", "auto");
			});
		    	toggleInputRow("#contourInputRow",function() { resetInputError("#contourInputRow"); $("#splineAlphaInput").val(DEFAULT_SPLINE_ALPHA); $("#resolutionInput").val(DEFAULT_SPLINE_RESOLUTION);});
		});

		$( "#depthInput" ).bind("change paste keyup",function() {
		 	validateInput("#depthInput", SLICE_DEPTH_RANGE );
		});

		$( "#splineAlphaInput" ).bind("change paste keyup",function() {
		 	validateInput("#splineAlphaInput", SPLINE_ALPHA_RANGE );
		});

		$( "#resolutionInput").bind("change paste keyup",function() {
		 	validateInput("#resolutionInput", SPLINE_RESOLUTION_RANGE);
		});

		$( "#timeInput").bind("change paste keyup",function() {

		let time = $("#timeInput").val();

		if ( valueImported(time, TIME_COLUMN) || isNaN(time)  ) {
			$("#timeInput"+"Group").addClass("has-error");
			$("#timeInput"+"GlyphIcon").removeClass("hidden");
		}
		else {
			$("#timeInput"+"Group").removeClass("has-error");
			$("#timeInput"+"GlyphIcon").addClass("hidden");
		}

	   });		

		//Ensure that the dynamic modal sizes properly
		$('#importModal').on('show.bs.modal', function () {
		       $(this).find('.modal-body').css({
			      width:'auto', 
			      height:'auto', 
			      'max-height':'100%'
		       });
		});

		$("#contourInputRow").collapse('hide');

		//Enable the tooltip on result table download dropdown menu.
		$("[data-tt=tooltip]").tooltip();
		$('.selectpicker').selectpicker('val', DEFAULT_BORDER_STYLE);
		setGUICallbacks();

		$("#dpiInput").val(RESULT_IMAGE_DPI);

		changeAnimal(cortexMapCore.DEFAULT_ANIMAL);

		$("#rightAffix").affix();


		//Define the measurement data table
		measurementDataTable = $('#measurementDataTable').DataTable( 
			{ 
				paging:   false,
				ordering : true,
				order: [[1, "asc"]],
				info:     false,
				searching : false,
				select: 'single', 
				columns: [
					{title: "File", orderable: false, width: 54},
					{title: "Day", orderable: false, width : 54},
					{title: "Type", orderable: false, width : 54}					
				],
				columnDefs:[{targets:0,className:"truncate"},
							],
				createdRow: function(row){
					var td = $(row).find(".truncate");
					td.attr("title", td.html());
				},
				fixedColumns : true,
				autoWidth: false

			}
		);
		//Make the selection of a table row to cause the displayed lesion change
		//accordingly 
		$('#measurementDataTable tbody').on( 'click', 'tr', function () {

			measurementDataTable.$('tr.selected').removeClass('selected');
			$(this).addClass('selected');
			
			let count = measurementDataTable.rows( '.selected' ).count();
			if ( count > 0 ) {

				let data = measurementDataTable.row( this ).data();
				currentKey = data[0];

				if ( isLesionEntry(currentKey)) {
					let currentLesionData = lesionDataMap[currentKey];
					displayLesion(currentLesionData);
					swapRatios(currentLesionData);
				}


				if (  $("#removeMeasurement").is(':hidden')) {
					$("#removeMeasurement").css('visibility','visible').hide().fadeIn(FAST_ANIMATION_DURATION*animationSpeed);
				}
			}
			else {
				$('#removeMeasurement').hide('fade', FAST_ANIMATION_DURATION*animationSpeed);
			}

		} );	
	}


	function valueImported(value, columnIndex) {
		if ( measurementDataTable.column(columnIndex).data().toArray().length == 0) {
			return false;
		}

		for ( let d = 0; d <  measurementDataTable.column(columnIndex).data().toArray().length; d++ ) {
			measurementDataTable.column(columnIndex).data().toArray()[d]
			if ( measurementDataTable.column(columnIndex).data().toArray()[d] == value ) {
				return true;
			}
		}
		return false;	
	}


	function validateInput(inputId,range) {

		if ( !isValidInputValue( parseFloat( $(inputId).val() ) ,range[0], range[1] ) ) {
			$(inputId+"Group").addClass("has-error");
			$(inputId+"GlyphIcon").removeClass("hidden");
		}
		else {
			$(inputId+"Group").removeClass("has-error");
			$(inputId+"GlyphIcon").addClass("hidden");
		}
	}

	function displayMap(svg) {

		$('#template-svg').empty();
		$('#template-svg').append(svg);


		$('#template-svg').children('svg').children('text').each(function () {
			$(this).attr("pointer-events","none");
		});

		
		$('#template-svg').children('svg').children('path').each(function () {
			if ( $(this).attr('id').startsWith("A_") ) {

				var areaName = $(this).attr('id').substring(2);
				var areaDescription = cortexMapCore.cortexMapTemplate.getAreas().get( areaName);
	
				 $(this).mouseover(function(event) {

					var rect = Snap(this);

					let yOffset = 35;
						let currentDescription = areaDescription;	

						if (currentKey && lesionDataMap[currentKey].ratiosMap.get(areaName) ) {

							currentDescription = currentDescription + "<br>" + lesionDataMap[currentKey].ratiosMap.get(areaName)[0] + "% affected"
							yOffset += 20
						}

					    // populate tooltip string
						$('#tooltip span').html(currentDescription);
						
						// show tooltip
						$('#tooltip').stop(false, true).fadeIn(1);

						// position tooltip relative to mouse coordinates
						$(this).mousemove(function() {
							$('#tooltip').css({'top':mouseY - yOffset,'left':mouseX - $('#tooltip').width() / 2});   
						}); 
						$(this).addClass("add_area_highlight")
						$('#tooltip').addClass("popup_visible")						
						$(this).removeClass("remove_area_highlight")


				 });
				 $(this).mouseout(function(event) {

					var rect = Snap(this);

					$(this).removeClass("add_area_highlight")					
					$(this).addClass("remove_area_highlight")

					$('#tooltip').removeClass("popup_visible")	
					// hide tooltip
					setTimeout(function(){
						if ( !$('#tooltip').hasClass("popup_visible") ) {
							$('#tooltip').stop(false, true).fadeOut(200);
							
						}

					},100);
					
				 });
			}
	   });	

		templateSVG = Snap($('#template-svg').children()[0]);
		templateSVG.node.id = 'main-template';
	}

	function insertElectrodes(svg,time) {
		let electrodeData = getElectrodeData();
		if ( electrodeData.length > 0 
			&& electrodeData[0][1] <= time
			 ) {
				drawElectrodes(false,svg,getElectrodeData(),false);
				return true;
		}
		return false;
	}

	function resizeUI() {

		let svg = document.getElementsByTagName('svg')[0];
		let aspectRatio = svg.getAttribute('height') / svg.getAttribute('width');

		svg.setAttribute('width',$("#mapColumn").width);
		svg.setAttribute('height', svg.getAttribute('width')*aspectRatio);
	}
	

	function getCombinedMeasurements() {

		let orderedDataTable = measurementDataTable.rows({ order: 'applied' }); 

		let data = orderedDataTable
		.data();

		var measurementDataMap = new Map();
		
		let areas = [];
		let timePoints = [];

		//Find all unique areas on all measurements
		data.each( (row, index) => {
			timePoints.push(row[1]);
			lesionDataMap[row[0]].ratiosFiltered.forEach( (value,key,map) => {
				areas.push(value[0]);
			});
		});

		areas = areas.filter( (value, index, self) => (self.indexOf(value) === index )  )

		var combinedMeasurements = [];
		//Find all unique areas on all measurements
		data.each( (row, index) => {
			let currentTimePoint = lesionDataMap[row[0]].ratiosMap;
			areas.forEach( (key) => {
				if ( !measurementDataMap.has(key) ) {
					measurementDataMap.set(key,[]);
				}

				if (currentTimePoint.has(key)) {
					measurementDataMap.get(key).push( currentTimePoint.get(key));
				}
				else {
					measurementDataMap.get(key).push([0,0]);
				}
			}
			);
	
		});	
		
		timePoints.sort();

		areas.forEach( (key) => { 
			combinedMeasurements.push( {
				area : key,
				values : measurementDataMap.get(key).map( (value, index ) => {
					return 	{
						time : timePoints[index],
						value : value[0],
						mm : value[1]
					}
				}
				),
				time : timePoints
			});
		});

		areas = areas.filter( (d)=> { return d != 'Total'});
		areas.push('Total');

		return  { measurements : combinedMeasurements, timePoints : timePoints, areas : areas };
	}

	function displayAreaChart() {

		$("#chartsDiv").empty();

		if ( getNLeasionEntries() < 2 ) {
			return;
		}

		let LEGEND_WIDTH = 150;
		let legend_margin = {top: 25, right: 25, bottom: 25, left: 25}
		let LEGEND_LABEL_WIDTH = 80;

		var lineOpacity = "0.85";
		var lineOpacityHover = "0.95";

		let areaOpacity = "0.25";

		var otherLinesOpacityHover = "0.1";
		var lineStroke = "1px";
		var lineStrokeHover = "2.5px";

		var circleOpacity = '0.9';
		var circleOpacityOnLineHover = "1.0"		
		var otherCircleOpacityOnLineHover = "0.25"
		var circleRadius = 2;
		var circleRadiusHover = 4;
		var duration = 250;

		let nAreas = 16*2;
		let nLegendColumnEntries = Math.floor(nAreas/2);
		let yTitleShift = 10;

		var dataset = getCombinedMeasurements();

		let separateAreaMeasurements = dataset.measurements.filter( (d) => { return d.area != 'Total'});
		let totalAreaMeasurements = dataset.measurements.filter( (d) => { return d.area == 'Total'});


		var margin = {top: 30, right: 55, bottom: 55, left: 65}
		, width = $("#chartsDiv").width() - margin.left - margin.right 
		, height = 500 - margin.top - margin.bottom; 

		let legend_x = width - LEGEND_WIDTH +  legend_margin.left;

		var xScale = d3.scaleLinear().range([0, width], 1);

		var yScale = d3.scaleLinear().range([height, 0]);		
	
		
		var color = (d) => {  
			if ( d == 'Total') {
				return "gray";
			}
			else {
				return d3.scaleOrdinal()
				.domain(dataset.areas)
				.range(["#2d9b19", "#e50ceb", "#fd2c2b", "#238dd0", "#a27c5f", "#da569a", "#239479", 
				"#956fed", "#c47225", "#9c75b2", "#748c40", "#e44f62", "#6f8796", "#e53ab3", "#978720", 
				"#b5747e", "#2e84ea", "#f3337e", "#c258cf", "#d36245", "#ed502a", "#6d9060", "#549542", 
				"#aa7e45", "#fb3466", "#469198", "#918199", "#81897d", "#d26564", "#ab7b20", "#c16597", 
				"#cf47ee", "#0b983e", "#5a9218", "#b96ab5", "#8c79d1", "#f03a9b", "#fe324b", "#459660", 
				"#5c8e7a", "#dd42d2", "#c9647c", "#8082b4", "#8b8861", "#ea5149", "#d66125", "#a76ace", 
				"#b15ceb", "#6382ce", "#6d79ea", "#ab7699", "#9c807d", "#7c8f1d", "#928744", "#5689b1", 
				"#de517d", "#c17346", "#d158b6", "#b97160", "#bc7363", "#ce55b3", "#be7044", "#e2547f", 
				"#598bb4", "#8f8541", "#7a8c1a", "#9a7d7b", "#a97397", "#707ced", "#6684d0", "#b45eee", 
				"#aa6cd1", "#d96428", "#e74e47", "#88855f", "#7d80b2", "#cc667f", "#da3fcf", "#5f907c", 
				"#43935d", "#fb2e48", "#ed3698", "#8977ce", "#b667b2", "#5d951b", "#139b41", "#cc44eb", 
				"#c4689a", "#ae7d22", "#cf6361", "#7e867a", "#8e7e96", "#438f95", "#f83063", "#a77b42", 
				"#52933f", "#6b8d5e", "#ea4d28", "#d66448", "#c55bd1", "#f63680", "#3386ed", "#b2727b", 
				"#94841d", "#e83db6", "#718a98", "#e75265", "#778f43", "#9e77b5", "#c17022", "#926cea", 
				"#27977c", "#d75398", "#a57f62", "#1d8acd", "#e816ee", "#2a9815", ])(d) 
			}

		};

		xScale.domain(
				[

					d3.min(dataset.measurements, function(c) {
					return d3.min(c.values, function(v) {
					return v.time;
					});
					}), 
					d3.max(dataset.measurements, function(c) {
						return d3.max(c.values, function(v) {
						return v.time;
						});
					}) 

				]
			) 
			.range([0, width-LEGEND_WIDTH]); 	

		yScale.domain([0, 100])
		.range([height, 0]);
		
		var svg = d3.select("#chartsDiv").append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");	


		svg.append("g")
			.attr("class", "axis")
			.style("font", "13px sans-serif")
			.attr("transform", "translate(0," + height + ")")
			.call(d3.axisBottom(xScale)
			.tickValues(dataset.timePoints)
			.ticks(dataset.timePoints.length)); 


		svg.append("g")
			.attr("class", "axis")
			.style("font", "12px sans-serif")	
			.call(d3.axisLeft(yScale)).append("text");


		d3.selectAll('.axis')
		.style("fill", "none")			
		.style("stroke", "#000000")
		.style("shape-rendering", "crispEdges")
		.style("stroke-width", "1px");

		d3.selectAll(".axis text")
		.style("stroke", "none")	
		.style("stroke-width", "0.01px")
		.style("shape-rendering", "crispEdges")
		.style("fill", "#000000")		

		let line = d3.line()
            .x(function(d) { return xScale(d.time); })
			.y(function(d) { return yScale(d.value); })
			
		let drawArea = d3.area()
			.x(function(d) { return xScale(d.time); })
			.y0( yScale(0) )
			.y1(function(d) { return yScale(d.value); })

		let highLightLine = function(l,area) {

			d3.selectAll('.line').filter((r)=> { return r.area != area})
			.transition()
			.duration(duration)
			.style('opacity', otherLinesOpacityHover)
			.style('fill', 'none');
			
			d3.selectAll('.circle').filter((r)=> { return r.area != area})
			.transition()
			.duration(duration)
			.style('opacity', otherCircleOpacityOnLineHover)
			.style('fill', 'none');;


			svg.selectAll('rect')
			.filter((r)=> { return r.area != area})
			.transition()
			.duration(duration)
			.style('opacity', otherLinesOpacityHover);

			svg.selectAll('rect')
			.filter((r)=> { 
				if (r == area) {
					return true;
				}
			})
			.transition()
			.duration(duration)
			.style('opacity', lineOpacityHover);


			svg.selectAll('.circle-group').filter((r)=> { 
				return r.area === area;})
			.transition()
			.duration(duration)
			.selectAll(".circle").style("opacity",circleOpacityOnLineHover)
			.style('fill', 'none');;


			d3.select(l)
			.transition()
			.duration(duration)
			.style('opacity', lineOpacityHover)
			.style("stroke-width", lineStrokeHover)
			.style("cursor", "pointer");
		}

		let resetColors = function(l) {
			d3.selectAll(".line")
			.transition()
			.duration(duration)
			.style('opacity', lineOpacity)
			.style('fill', 'none');;
			d3.selectAll('.circle')
			.transition()
			.duration(duration)
			.style('opacity', circleOpacity);
			d3.select(l)
			.transition()
			.duration(duration)
			.style("stroke-width", lineStroke)
			.style("cursor", "none");

			d3.selectAll('rect')
			.transition()
			.duration(duration)
			.style('opacity',lineOpacity);
		}

		var measurement = svg.selectAll(".total-area-group")
		.data(totalAreaMeasurements)
		.enter()
		.append("g")
		.attr("class", "total-area-group")
		.append("path")
		.attr("class", "area")
		.attr("d", function(d) {
	  
		  return drawArea(d.values);
		}
		)
		.style("fill", function(d) {
		  return color(d.area);
		})
		.style('fill-opacity',areaOpacity)
		.style("stroke", "none")

		var measurement = svg.selectAll(".area-group")
		.data(dataset.measurements)
		.enter()
		.append("g")
		.attr("class", "area-group")
		.append("path")
		.attr("class", "line")
		.style('fill', 'none')
		.attr("d", function(d) {
		
		  return line(d.values);
		}
		)
		.style("stroke", function(d) {
		  return color(d.area);
		})
		.style("stroke-dasharray", function(d) {
			if ( d.area == "Total") {
				return ("3, 3");
			}
			return null;
		}
		)
		.style('opacity',lineOpacity)
		.style("stroke-width", lineStroke)

		.on("mouseover", function(d) {
			highLightLine(this,d.area);
		  })
		.on("mouseout", function(d) {
			resetColors(this);
		  }); 	  

		 svg.selectAll(".circle-group")
		.data(dataset.measurements).enter()
		.append("g")
		.attr("class", "circle-group")
		.style("fill", (d, i) => color(d.area))
		.selectAll("circle")
		.data(d => d.values).enter()
		.append("g")
		.attr("class", "circle")  
		.style('fill', 'none')
		.on("mouseover", function(d) {
			d3.select(this)     
				.style("cursor", "pointer")
				.append("text")
				.attr("class", "text")
				.text(`${d.value}`)
				.attr("x", d => xScale(d.time) + 5)
				.attr("y", d => yScale(d.value) - 10);
			})
		.on("mouseout", function(d) {
			d3.select(this)
				.style("cursor", "none")  
				.transition()
				.duration(duration)
				.selectAll(".text").remove();
			})
		.append("circle")
		.attr("cx", d => xScale(d.time))
		.attr("cy", d => yScale(d.value))
		.attr("r", circleRadius)
		.style('opacity', circleOpacity)
		.style('fill', 'none')
		.on("mouseover", function(d) {
				d3.select(this)
				.transition()
				.duration(duration)
				.attr("r", circleRadiusHover);
				let currentArea = d3.select(this.parentNode.parentNode).datum().area;
				highLightLine(svg.selectAll(".line").filter((r)=>{return r.area === currentArea ;}).nodes()[0],currentArea); 
			})
			.on("mouseout", function(d) {
				d3.select(this) 
				.transition()
				.duration(duration)
				.attr("r", circleRadius);  
				resetColors(svg.selectAll(".line").filter((r)=>{return r.area === d ;}).nodes()[0]);
			});		  
	
		var size = 20
		svg.selectAll("legend_dots")
		  .data(dataset.areas)
		  .enter()
		  .append("rect")
			.attr("x", function (d,i ) {
										if ( i < nLegendColumnEntries) {
											return legend_x ;
										}
										else {
											return legend_x + LEGEND_LABEL_WIDTH;
										}

									}
				)
			.attr("y", function(d,i){ if ( i < nLegendColumnEntries ) {
											return i*(size+5)
										}
										else {
											return (i-nLegendColumnEntries)*(size+5)
										}
									}) 
			.attr("width", size)
			.attr("height", size)
			.style("fill", function(d){ return color(d)})
			.on("mouseover", (d) => {			
				highLightLine(svg.selectAll(".line").filter((r)=>{return r.area === d ;}).nodes()[0],d); 
			})
			.on("mouseout", (d) => {resetColors(svg.selectAll(".line").filter((r)=>{return r.area === d ;}).nodes()[0]); });
		
		svg.selectAll("legend_labels")
		  .data(dataset.areas)
		  .enter()
		  .append("text")
			.attr("x", function (d,i) {
										if ( i  < nLegendColumnEntries ){
											return legend_x + size*1.2;
										}
										else {
											return LEGEND_LABEL_WIDTH + legend_x + size*1.2;
										}
									}
			)
			.attr("y", function(d,i){
					if ( i < nLegendColumnEntries) {
						return 0 + i*(size+5) + (size/2)
					} 
					else {
						return (i-nLegendColumnEntries)*(size+5) + (size/2) 
					}
					
				}) 
			.attr("dy", ".35em")
			.style("fill", function(d){ return color(d)})
			.text(function(d){ return d})
			.attr("text-anchor", "right")
			.style("alignment-baseline", "middle")
			.on("mouseover", (d) => {			
				highLightLine(svg.selectAll(".line").filter((r)=>{return r.area === d ;}).nodes()[0],d); 
			})
			.on("mouseout", (d) => {resetColors(svg.selectAll(".line").filter((r)=>{return r.area === d ;}).nodes()[0]); });

		svg.append("text")             
		.attr("transform",
			"translate(" + ((width -LEGEND_WIDTH - legend_margin.left - legend_margin.right - margin.left)/2 + margin.left) + " ," + 
							(height + margin.top + 20) + ")")
		.style("text-anchor", "middle")
		.text("Day")
		.style("font-size","16px");
		

	svg.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 0 - margin.left + yTitleShift)
		.attr("x",0 - (height / 2))
		.attr("dy", "1em")
		.style("text-anchor", "middle")
		.text("Area %")
		.style("font-size","16px");  	
		
	}

	function changeAnimal(animal, fade) {
		cortexMapCore.setAnimal(animal, function () {	
			if (fade) { 
				$("#mainUI").fadeOut( FAST_ANIMATION_DURATION*animationSpeed, function() {

					displayMap(cortexMapCore.getTemplateSVG());
					$("#mainUI").fadeIn(FAST_ANIMATION_DURATION*animationSpeed);

				});
			}
			else {
					displayMap(cortexMapCore.getTemplateSVG());
			}
			
			//Reveal the UI for the first time
			if ($('#mainNavBar').is(':hidden')) {
				$( "#mainUI" ).fadeIn(SLOW_ANIMATION_DURATION*animationSpeed);	
				$( "#mainNavBar" ).fadeIn(SLOW_ANIMATION_DURATION*animationSpeed);
			}
			else {
				$( "#mainUI" ).fadeIn(SLOW_ANIMATION_DURATION*animationSpeed);	
			}

			resizeUI();

		});

	}

	return {
		selectFile: selectFile,
		showSettings : showSettings,
		downloadTable : downloadTable,
		downloadImage : downloadImage,
		downloadMeasurements : downloadMeasurements,
		changeAnimal : changeAnimal,
		init : init
	};

})();

$(document).ready(function(){

	cortexMapCore.init(()=> {
		cortexMapGUI.init();
	});	

});

module.exports = cortexMapGUI;

