/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/

var cortexMapCore = require('./CortexMapCore.js');
var colorPicker = require('bootstrap-colorpicker');

var cortexMapGUI = (function(){
'use strict';
	var CONTROL_HEIGHT = 34;
	var RESULT_IMAGE_DPI = 300;
	var ADDITIONAL_INPUT_PADDING = 15;

	var DEFAULT_SLICE_DEPTH = 0; 
	var SLICE_DEPTH_RANGE=[0,1];
	var DEFAULT_SPLINE_ALPHA = 0.5;
	var SPLINE_ALPHA_RANGE = [0,1];	
	var DEFAULT_SPLINE_RESOLUTION = 10;
	var SPLINE_RESOLUTION_RANGE =[10,100];		
	var DEFAULT_BORDER_STYLE = 'solid';

	const DEFAULT_ANIMATION_DURATION = 400;
	const FAST_ANIMATION_DURATION = 200;
	const SLOW_ANIMATION_DURATION = 600;


	var fill_color = "rgba(0, 0, 255, 0.5)";
	var border_color = "rgba(0, 0, 255, 1)";
	var animationSpeed = 1.0;

	var mapImage;
	var debugMode = false;

	var mappingResults = {};
	var allRatios = {};

	var templateSVG;

	var lesionPolygon;

	var areaData = new Map();


	function getCurrentFillColor() {
		return window.CortexMapOverrides && window.CortexMapOverrides.fillColor ? CortexMapOverrides.fillColor : fill_color;
	}

	function getCurrentBorderColor() {
		return window.CortexMapOverrides && window.CortexMapOverrides.borderColor ? CortexMapOverrides.borderColor : border_color;
	}

	function getCurrentBorderWidth() {
		return window.CortexMapOverrides && window.CortexMapOverrides.borderWidth ? CortexMapOverrides.borderWidth : $("#borderWidthInput").val();
	}		

	function getCurrentBorderStyle() {
		return window.CortexMapOverrides && window.CortexMapOverrides.borderStyle ? CortexMapOverrides.borderStyle : $(".selectpicker").val();
	}	

	function getCurrentDPI() {
		return window.CortexMapOverrides && window.CortexMapOverrides.dpi ? CortexMapOverrides.dpi : $("#dpiInput").val();
	}

	function handleAnimalOverride() {
		if ( window.CortexMapOverrides && window.CortexMapOverrides.animal ) {
			changeAnimal(window.CortexMapOverrides.animal);
		}
	}

	//Display the table presenting the ratios of areas affected.
	function showRatios(allRatios) {
		$("#ratioDiv").empty();

		
		var table = makeTable(allRatios,'ratioTable',['Area','%','mm<sup>2</sup>']);
		$("#ratioDiv").append(table);

		$("#ratioDiv").css('visibility','visible').hide().fadeIn(DEFAULT_ANIMATION_DURATION*animationSpeed);

		$("#saveTable").css('visibility','visible').hide().fadeIn(DEFAULT_ANIMATION_DURATION*animationSpeed);
		$("#saveImage").css('visibility','visible').hide().fadeIn(DEFAULT_ANIMATION_DURATION*animationSpeed);
	}

	//Creates a table with the given id based on the data and header provided
	function makeTable(data, id, headers) {

		//var html = '<table class="table" id="ratioTable"><thead><tr><th>Area</th><th>%</th></tr></thead><tbody>';
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

		return html;
	}


	//Displays the import modal
	function showImportModal(importedCoordinates) {
		//Reset additional inputs
		if ( !$( "#depthInputRow" ).hasClass('collapse in') ) {
			$("#depthInputRow" ).collapse('hide');
			$("#labelStained").button('toggle');
		}
		if ( $( "#contourInputRow" ).hasClass('collapse in') ) {
			$("#contourInputRow" ).collapse('hide');
			$("#labelLinear").button('toggle');
		}

		var table = makeTable(importedCoordinates,'Coordinates',['Bregma','M1','M2','M3']);
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
		$('#importCoordinatesButton').bind('click',function() { importCoordinates(importedCoordinates);});  
	}

	//Displays the import modal
	function importCoordinates(importedCoordinates) {
		
		var sliceDepth = parseFloat($("#depthInput").val());
	
		if ( !isValidInputValue(sliceDepth,SLICE_DEPTH_RANGE[0],SLICE_DEPTH_RANGE[1])) {
			validateInput("#depthInput", SLICE_DEPTH_RANGE);
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
				
				mappingResults = results;
				
				$(document).trigger( "loader:hide");
				clearMap(); 
				//Draw the lesion
			  	lesionPolygon = templateSVG.polygon(mappingResults.lesionPolygon).fill(fill_color).stroke({ width: 1, color : border_color });

				setLesionProperties(lesionPolygon);
				allRatios = results.ratios;

				showRatios(allRatios);

			};
			//Check if the app is run e.g. within a headless browser and the current animal has been overriden.
			handleAnimalOverride();
			cortexMapCore.performMapping( importedCoordinates, interpolationSettings, sliceDepth, analysisFinishedCallback);
			
		}

	}

	function setLesionProperties(lesionPolygon){

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

	//Opens a file selector
	function selectFile(){

		//Callback for file selection
		function respondToFileSelection(evt){

			//Display the loading animation
			$(document).trigger('loader:show');

		   	var file = evt.target.files[0];

		
			var importFinishedCallback = function (specified_coordinates) {

				$(document).trigger( "loader:hide");
				if ( specified_coordinates != null )  {
					showImportModal(specified_coordinates);
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

	//Opens a download dialog for the ratios table
	function downloadTable() {
		var csvContent = tableToCSV(allRatios);
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

		var csvContent = tableToCSV(mappingResults.measurementTable);

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

	//Opens a download dialog for the lesion map image
	function downloadImage() {

		var fileName = "mapped.tiff";
		var options = {};

		var downloadImageCanvas = document.createElement('canvas');

		cortexMapCore.paintMapToCanvas(downloadImageCanvas, templateSVG, function(downloadImageCanvas) {
			options.dpi = getCurrentDPI();

			if ( isIE()) {
				CanvasToTIFF.toBlob(downloadImageCanvas, function(blob) {
			        window.navigator.msSaveOrOpenBlob(blob, fileName);
				});		
			}
			else {
			
				CanvasToTIFF.toDataURL(downloadImageCanvas, function(url) {
					var link = document.getElementById("downloadImageLink");
					link.setAttribute('href', url);
					link.setAttribute("download", fileName);
					document.body.appendChild(link); 
					link.click();
				}, options);
			}
		});
		
		
	}

	//Transforms the given data array into textual csv format
	function tableToCSV(data) {

		var csvContent = "data:text/csv;charset=utf-8,";
		data.forEach(function(infoArray, index){

		   var dataString = infoArray.join(",");
		   csvContent += index < data.length ? dataString+ "\r\n" : dataString;

		}); 
		return csvContent;
	}

	function showSettings() {
		$('#settingsModal').modal();  

		$('#fillColorPicker').colorpicker({ color : fill_color, container: "#fillColorPicker" });
		$('#borderColorPicker').colorpicker({ color : border_color, container: "#borderColorPicker" });
		$('#settingsModal').unbind('hidden.bs.modal');
		$('#settingsModal').on('hidden.bs.modal', function (event) {
			var selectedFillColor = $('#fillColorPicker').data('colorpicker').color.toRGB();
			fill_color = "rgba(" + selectedFillColor.r +"," + selectedFillColor.g + "," + selectedFillColor.b +"," + selectedFillColor.a +")";
			var selectedBorderColor = $('#borderColorPicker').data('colorpicker').color.toRGB();
			border_color = "rgba(" + selectedBorderColor.r +"," + selectedBorderColor.g + "," + selectedBorderColor.b +"," + selectedBorderColor.a +")";
			repaintContour();
		});
	}

	function repaintContour() {
		if (lesionPolygon) {
			setLesionProperties(lesionPolygon);
		}
	}

	function clearMap() {
		displayMap(cortexMapCore.getTemplateSVG());
		resizeUI();	
	}

	function showErrorMessage(message) {
		var html = "<div class='alert alert-danger fade in' id='inputErrorAlert'><a href='#' class='close' data-dismiss='alert' aria-label='close'>&times;</a><strong>Error!</strong> "+message+"</div>";
		$("#alertDiv").append(html);
		$("#inputErrorAlert").fadeIn(DEFAULT_ANIMATION_DURATION*animationSpeed);
	}

	function isValidInputValue(value, minValue, maxValue) {

		if ( isNaN(value) || value < minValue || value > maxValue ) {
			return false;
		}
		else {
			return true;
		}
	}

	function toggleInputRow(modalId,inputId, resetCallback, mode) {


		if (typeof mode === 'undefined' || mode == 'slide') {

			if ( !$( inputId ).hasClass('collapse in') ) {
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

	function setInteractions() {
		$("#upload" ).click(selectFile);
		$("#settings").click(showSettings);
		$("#downloadTable").click(downloadTable);
		$("#saveImage").click(downloadImage);
		$("#downloadMeasurements").click(downloadMeasurements);

	}

	function fadeOutAndSwitchContent() {
		let page = this.getAttribute("data-page");
		let callback = function() {};

		if ( page == "analyze.html" ) {
			callback = initAnalysis;
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
			initAnalysis();
		});

		$(".nav-link").click( fadeOutAndSwitchContent );
		$(".navbar-brand").click( fadeOutAndSwitchContent );

	}

	function initAnalysis() {

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
			$("#inputTypeRadioButtons label").css("pointer-events", "none");
			$('#depthInputRow').on("shown.bs.collapse hidden.bs.collapse", function(){
				$("#inputTypeRadioButtons label").css("pointer-events", "auto");
			});

		    	toggleInputRow("#importModalBody","#depthInputRow", function() { resetInputError("#depthInputRow"); $("#depthInput").val(DEFAULT_SLICE_DEPTH); }, 'slide');
		});

		//Add lister for the choice between linear and spline contour
		$("#contourRadioButtons :input").bind("change",function() {
			$("#contourRadioButtons label").css("pointer-events", "none");

			$('#contourInputRow').on("shown.bs.collapse hidden.bs.collapse", function(){
				$("#contourRadioButtons label").css("pointer-events", "auto");
			});
		    	toggleInputRow("#importModalBody","#contourInputRow",function() { resetInputError("#contourInputRow"); $("#splineAlphaInput").val(DEFAULT_SPLINE_ALPHA); $("#resolutionInput").val(DEFAULT_SPLINE_RESOLUTION);});
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
		setInteractions();

		$("#dpiInput").val(RESULT_IMAGE_DPI);

		changeAnimal(cortexMapCore.DEFAULT_ANIMAL);

	}

	function displayMap(svg) {

		$('#template-svg').empty();
		$('#template-svg').append(svg);
		templateSVG = SVG.adopt($('#template-svg').children()[0]);
	}

	function resizeUI() {
		var controlDivHeight = $("#controlDiv").height();
		var saveDivHeight = $("#saveDiv").height();
		//Scale the template to maximally fill the template column
		let aspectRatio = templateSVG.width() /templateSVG.height();

		//templateSVG.width($('#mapColumn').width());
		templateSVG.width($('#mapColumn').width());		
		templateSVG.height(templateSVG.width()/aspectRatio);
		//Set the interaction column to equal height with the template column.
		$("#interactionColumn").height($("#mapColumn").height());
		$("#resultsDiv").height( $("#interactionDiv").height() - CONTROL_HEIGHT -  $("#controlDiv").height() );
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

	function resetUI() {		
		displayMap(cortexMapCore.getTemplateSVG());
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

	cortexMapGUI.init();
});

module.exports = cortexMapGUI;

