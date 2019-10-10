/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/

var cortexMapper = (function(){
'use strict';

	var cortexMapTemplate = require('./CortexMapTemplate.js');
	var work = require('webworkify');

	var bregmaLevelWidths = [];
	var coordinates = [];
	var borders = [];
	var mappingData = {};

	var template = cortexMapTemplate;

	const MAPPER_WORKER_PATH = './workers/mapperWorker.js';

	const CANVAS_SIZE_FACTOR = 4;

	//Calculates the areas affected by the lesion.
	function performAnalysis(analysisFinishedCallback) {
		let results = {};
		results.ratios = mapToArray(mappingData.effectedAreas);
		results.measurementTable = mappingData.measurementTable;
		results.lesionPolygon = coordinates;
		results.borders = borders;
		results.areaData = template.getTemplateData();
		analysisFinishedCallback(results);
	}

	//Transforms pixel intensity values into corresponding labels
	function mapToArray(resultMap) {

		let resultArray = [];

		resultMap.forEach( function(entry, name) {
			resultArray.push([name, entry[0], entry[1] ]);
		});

		return resultArray;
	}

	
	function performMapping(importedCoordinates,interpolationSettings, sliceDepth, mappingFinishedCallback) {

		//Import the data asynchronously using a worker thread.
		var importWorker = work( require( './workers/mapperWorker.js'));
		//Set up the data object
		var importData = {};
	
		importData.templateData = template.getTemplateData();
		importData.size = [ template.getTemplateSVG()[2].getAttribute("width"), template.getTemplateSVG()[2].getAttribute("height") ];
		importData.interpolationSettings = interpolationSettings;

		importData.importedCoordinates = importedCoordinates;
	
		importData.sliceDepth = sliceDepth;
		importData.bregmaLevelWidths = bregmaLevelWidths;
		importWorker.addEventListener('message', function(e) {

			if ( e.data.debug ) {
				console.log(e.data.message);
			}
			else {
				coordinates = e.data.lesionPolygon;
				borders = e.data.borders;
				mappingData.effectedAreas = e.data.effectedAreas;
				mappingData.measurementTable = e.data.measurementTable;
				performAnalysis(mappingFinishedCallback); 
		 	}

		}, false);

		importWorker.postMessage(importData);
	}

	function getCoordinates() {
  		return coordinates;
	}

	function getBorders() {
  		return borders;
	}

	function init(animal, completedCallback) {
		setAnimal(animal,completedCallback);
	}

	function getTemplateSVG() {
		return template.getTemplateSVG();
	}

	function setAnimal(animal, completedCallback) {
		animal = animal.toLowerCase();

		//Load Bregma level widths
		$.getJSON( "./data/" + animal + "/bregma_level_widths.json", function( fetchedBregmaLevelWidths ) {
			bregmaLevelWidths = fetchedBregmaLevelWidths;
			template.init(animal,completedCallback);
		});

	}

	function paintMapToCanvas( downloadImageCanvas, mapElement, width, height, callback, scale=false,time=null) {

		let ctx = downloadImageCanvas.getContext("2d");
		if (scale) {

			downloadImageCanvas.width = width*CANVAS_SIZE_FACTOR;
			downloadImageCanvas.height = height*CANVAS_SIZE_FACTOR;
		}

		let drawnSVG = $(mapElement);

		drawnSVG.attr('width', downloadImageCanvas.width);
		drawnSVG.attr('height', downloadImageCanvas.height);
		drawnSVG.each(function () { $(this)[0].setAttribute('viewBox', "0 0 " + width + " " + height) });


		ctx.beginPath();
		ctx.rect(0, 0, downloadImageCanvas.width , downloadImageCanvas.height);
		ctx.fillStyle = "white";
		ctx.fill();

		var svgString = new XMLSerializer().serializeToString(drawnSVG[0]);

		svgString = svgString.replace( /xmlns:xml="[A-Za-z0-9/:#-.]*"/gi,'');
		svgString = svgString.replace( />\/svg>/gi,'></svg>');	
		
		var DOMURL = self.URL || self.webkitURL || self;

		var img = new Image();
		var svg = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
		var url = DOMURL.createObjectURL(svg);
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
			DOMURL.revokeObjectURL(url);
			

			if ( time !== null ) {
				ctx.font = "bold 80px serif";
				ctx.fillStyle = "black";
				ctx.fillText("Day " + time, 80, 100); 
			}

			callback(downloadImageCanvas);
		};

		img.src = url

	}

	return {
		getCoordinates : getCoordinates,
		performMapping : performMapping,
		paintMapToCanvas : paintMapToCanvas,
		setAnimal : setAnimal,
		getTemplateSVG : getTemplateSVG,
		init : init
	};
})();

module.exports = cortexMapper;
 


