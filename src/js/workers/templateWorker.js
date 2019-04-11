/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
const { pathDataToPolys } = require('svg-path-to-polygons');
var Shape = require('clipper-js').default;

module.exports = function (self) {

self.addEventListener('message', function(e) {  

	let areaData = e.data.areaData;

	function createPolygonPath(coordinates) {
		let polygonPath = [[]]; 	
		for (let i = 0; i < coordinates.length; i++) {
			polygonPath[0].push( { X : coordinates[i][0], Y : coordinates[i][1] });
		}
		return polygonPath;
	}
	let totalArea = 0;
	areaData.forEach(
		function(value, key, map) {
			value.coordinates = pathDataToPolys( value.path, {tolerance:1, decimals:3} )[0];
			var polygonPath = createPolygonPath(value.coordinates);
			value.polygon = polygonPath;
			value.area = Math.abs(new Shape(value.polygon).totalArea()); 
			totalArea += value.area;
		}
	);
	let rhinalFissurePolygon = pathDataToPolys( e.data.rhinalFissure, {tolerance:1, decimals:3} );

	self.postMessage( { areaData : areaData, rhinalFissure : rhinalFissurePolygon[0], totalArea : totalArea } );
}, false);

};
