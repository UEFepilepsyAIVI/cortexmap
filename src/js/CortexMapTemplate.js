/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/

var CortexMapTemplate = (function(){
	'use strict';
	var work = require('webworkify');
	var mod = require('module');

	var templateSVG = [];
	var templateSVGDefinition = [];
	var templateData =  {
		areaData : new Map(),
		unitsPerMM : [],
		rhinalFissure : []
	};

	/*
	Extract the cortical regions from the SVG template
	*/
	function extractTemplateData(completedCallback) {

		//Extract units per mm measure
		templateData.unitsPerMM = parseFloat(templateSVG.find('[id^="MMperX"]')[0].getAttribute("width"));
		templateData.unitsPerMMY = parseFloat(templateSVG.find('[id^="MMperY"]')[0].getAttribute("height"));

		templateData.rhinalFissure = templateSVG.find('[id^="RhinalFissure"]')[0].getAttribute("d");

		templateData.YZero = parseFloat(templateSVG.find('[id^="YZero"]')[0].getAttribute("y"));

		var areaElements = templateSVG.find('[id^="A_"]');
		var i = 0;
		processWithPause();

		function processWithPause() {
			i = processAreaElement(areaElements[i],i);
			if ( i < areaElements.length ) {
				setTimeout(processWithPause, 5);
			} 	
			else {

				completedCallback();
			}
		}
	}

	/*
	Extract SVG path string corresponding to an area in the template and store in in the area data map.
	*/
	function processAreaElement(areaElement, index) {
		var areaDataEntry = {};
		var areaId = areaElement.id.replace('A_','');

		areaDataEntry.polygon = [];
		areaDataEntry.area = [];
		areaDataEntry.path = areaElement.getAttribute("d");
		templateData.areaData.set( areaId, areaDataEntry);
		return index+1;
	}
	
	function init(animal,completedCallback) {
		var ajax = new XMLHttpRequest();
		ajax.open('GET', './data/' + animal.toLowerCase() +'/' + animal.toLowerCase() + '_map.svg', true);
		ajax.send();
		ajax.onload = function(e) {
			templateSVGDefinition = ajax.responseText;
			templateSVG = $(templateSVGDefinition);
			var w = work(require('./workers/templateWorker.js'));
			w.addEventListener('message', function (ev) {
				if (ev.data.debug) {
					console.log(ev.data.debug);	
				}
				else {

				    	templateData.areaData = ev.data.areaData;
					templateData.rhinalFissure = ev.data.rhinalFissure;
					templateData.totalArea = ev.data.totalArea;
				    	if ( typeof completedCallback === 'function') {
						completedCallback();
					}
				}
			});
			extractTemplateData( function() {
				w.postMessage(templateData);

			});

		};
	}

	function getTemplateSVG() {

		return $(templateSVGDefinition);
	}

	function getTemplateData() {
		return templateData;
	}

	return {
		getTemplateSVG : getTemplateSVG,
		getTemplateData : getTemplateData,
		init : init
	};


})();

module.exports = CortexMapTemplate;
