/*
Last update: 16.4.2017
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
const cortexMapper = require('./CortexMapper.js');
const dataImporter = require('./CortexMapDataImporter');

var CortexMapCore = ( function() {

	var DEFAULT_ANIMAL = 'mouse';

	return {
		getCoordinates : cortexMapper.getCoordinates,
		performMapping : cortexMapper.performMapping,
		importData : dataImporter.importData,
		setAnimal : cortexMapper.setAnimal,
		mapImage : cortexMapper.mapImage,
		getTemplateSVG : cortexMapper.getTemplateSVG,
		paintMapToCanvas : cortexMapper.paintMapToCanvas,
		DEFAULT_ANIMAL : DEFAULT_ANIMAL,
	};
	

})();

module.exports = CortexMapCore;

