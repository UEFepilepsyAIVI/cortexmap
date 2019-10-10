/*
Last update: 16.4.2017
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
require("babel-core/register");
require("babel-polyfill");


var CortexMapCore = ( function() {

	const cortexMapper = require('./CortexMapper.js');
	const dataImporter = require('./CortexMapDataImporter');
	const cortexMapTemplate = require('./CortexMapTemplate.js');	

	const DEFAULT_ANIMAL = 'mouse';	

	function init( callBack ){
		cortexMapTemplate.init( DEFAULT_ANIMAL, callBack)
	}

	return {
		getCoordinates : cortexMapper.getCoordinates,
		performMapping : cortexMapper.performMapping,
		importData : dataImporter.importData,
		setAnimal : cortexMapper.setAnimal,
		mapImage : cortexMapper.mapImage,
		getTemplateSVG : cortexMapper.getTemplateSVG,
		paintMapToCanvas : cortexMapper.paintMapToCanvas,
		DEFAULT_ANIMAL : DEFAULT_ANIMAL,
		cortexMapTemplate : cortexMapTemplate,
		init : init
	};
	

})();

module.exports = CortexMapCore;

