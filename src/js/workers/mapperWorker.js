/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
let Shape = require('clipper-js').default;
let lib = require('kld-intersections');
let Point2D = lib.Point2D;
let Intersection = lib.Intersection;
let Shapes = lib.Shapes;
let catmullRomInterpolator = require('catmull-rom-interpolator')
'use strict';


module.exports = function (self) {

	self.addEventListener('message', function(e) {
		
		var debug = {};
		debug.debug = true;
		let TOTAL_AREA_LABEL = 'Total';

		//Maps the coordinates
		function mapToRegions( coordinates, templateData, templateSize,  atlasData, interpolationSettings ) {

			var trueYCoordinates = [];

			measurementTable = [];
			var rightSide = [];
			var leftSide = [];
			var borders = [];

			let rhinalFissureCoordinateList = [];
			for (row of templateData.rhinalFissure) for (entry of row) rhinalFissureCoordinateList.push(entry);
			let rhinalFissure = Shapes.polyline(rhinalFissureCoordinateList);
			//Process each bregma level
			for ( let i = 0; i < coordinates.length; i++ ) {

				let mValueSum = 0;

				var nearestAtlasLevel = findNeasrestAtlasLevel(coordinates[i][0]);
				let translatedY = templateData.YZero - parseFloat(templateData.unitsPerMMY)*coordinates[i][0];
				//Draw a line through the image on the level given by Y	
				let yLine = Shapes.line(0,translatedY, templateSize[0], translatedY );

				let medialReferenceIntersection = findRightmostX(yLine);

				//Determine the X coordinate where line intersects with RF
				let rfIntersection = Intersection.intersect(yLine,rhinalFissure)
				if ( rfIntersection.points.length ==  0 ) {
					continue;	
				}

				//For debug
				borders.push([rfIntersection.points[0].x,translatedY,rfIntersection.points[0].x + nearestAtlasLevel[1]*parseFloat(templateData.unitsPerMM), translatedY ])

				var lesionLeft, lesionRight = null;
				let shrinkageFactor;
				if ( coordinates[i][3] >= 0 ) {
					//Sum up the M1, M2 and M3 distances
					for ( let j = 1; j < coordinates[i].length-1; j++) {
						mValueSum +=  coordinates[i][j];
					}
					shrinkageFactor = mValueSum / nearestAtlasLevel[1];

					//Calculate the lesion X_M1, X_M2 coordinates in the image space
					lesionLeft = rfIntersection.points[0].x +( ( parseFloat(coordinates[i][3])*parseFloat(templateData.unitsPerMM) ) / shrinkageFactor);
					lesionRight = lesionLeft + (( parseFloat(coordinates[i][2])*templateData.unitsPerMM ) / shrinkageFactor);
				}
				else {
					mValueSum = coordinates[i][2] + coordinates[i][1];
					shrinkageFactor = mValueSum / nearestAtlasLevel[1];
					//Calculate the lesion X_M1, X_M2 coordinates in the image space
					lesionLeft = rfIntersection.points[0].x + (( parseFloat(coordinates[i][3])*parseFloat(templateData.unitsPerMM) ) / shrinkageFactor);
					lesionRight = lesionLeft + (( parseFloat(coordinates[i][2])*templateData.unitsPerMM ) / shrinkageFactor);
				}
				
				measurementTable.push([coordinates[i][0],coordinates[i][1],coordinates[i][2],coordinates[i][3], mValueSum]);

				//Add the coordinates of the left and right side of the lesion to corresponding list
				leftSide.push( [ lesionLeft, translatedY,coordinates[i][4]] );
				rightSide.push( [ lesionRight, translatedY,coordinates[i][4]] );	


			}

			rightSide.sort(compareYAscending);
			leftSide.sort(compareYDescending);

			function compareYAscending(a, b) {
			    if (a[1] === b[1]) {
				return 0;
			    }
			    else {
				return (a[1] < b[1]) ? -1 : 1;
			    }
			}

			function compareYDescending(a, b) {
			    if (a[1] === b[1]) {
				return 0;
			    }
			    else {
				return (a[1] > b[1]) ? -1 : 1;
			    }
			}
			
			function findRightmostX( yLine ) {
			
				let rightmostX = 0;
		
				templateData.areaData.forEach( function(entry, name) {
					let areaCoordinateList = [];
					for (row of entry.polygon) {
						for (coordinate of row) { 
							areaCoordinateList.push(coordinate.X);
							areaCoordinateList.push(coordinate.Y);					
						}	
					}
					let areaPolygon = Shapes.polyline(areaCoordinateList);

					let polygonIntersection = Intersection.intersect(yLine,areaPolygon)
					for ( let i= 0; i < polygonIntersection.points.length; i++ ) {
						if ( polygonIntersection.points[i].x > rightmostX ) {
							rightmostX = polygonIntersection.points[i].x; 
						}
					}

				});
				return rightmostX;
			}

			function findNeasrestAtlasLevel(y) {

				var nearestIndex = 0;
				var smallestDistance = Infinity;

				for ( var i = 0; i < atlasData.length; i++) {
					var distance = Math.abs( y - atlasData[i][0]);

					if ( distance < smallestDistance ) {
						nearestIndex = i;
						smallestDistance = distance;
					}
				}		
				return atlasData[nearestIndex];
			}


			function contourToShape(contour,scaleFactor = 1.0) {
				var polygonPath = [[]]; 

				for (var i = 0; i < contour.length; i++) {
					polygonPath[0].push( { X : parseFloat(contour[i][0])*scaleFactor, Y : parseFloat(contour[i][1])*scaleFactor });
				}
				return new Shape(polygonPath, closed = true);
			}


			function roundToDecimal(value, decimals = 2) {
				let accuracy = Math.pow(10,decimals);
				return Math.round(value*accuracy)/accuracy;
			}

			function calculateEffectedAreas(contour, templateData) {
				let effectedAreas = new Map();
				let totalEffectedArea = 0;
				const SCALE_FACTOR = 100.0;
				let scaledContour = contourToShape(contour,SCALE_FACTOR)
				templateData.areaData.forEach( function(entry, name) {


					let scaledPolygon = [entry.polygon[0].map( (d) => { return { X: d.X*SCALE_FACTOR, Y: d.Y*SCALE_FACTOR }})]				
					let intersection = new Shape(scaledPolygon, true).intersect(scaledContour );	

					let polygonTotalArea = Math.abs(new Shape(scaledPolygon,true).totalArea());

					let percent = (  intersection.totalArea() / polygonTotalArea )*100;

					let squareMM = intersection.totalArea()*Math.pow(Math.pow(templateData.unitsPerMM*100,-1),2);

					effectedAreas.set(name,[ roundToDecimal(percent, decimals=1), roundToDecimal(squareMM)]);
					totalEffectedArea += intersection.totalArea() / (SCALE_FACTOR*SCALE_FACTOR);	
			

				});
				let totalEffectAreaPercent = (totalEffectedArea/ templateData.totalArea)*100;
				let totalEffectAreaMM = totalEffectedArea*Math.pow(Math.pow(templateData.unitsPerMM*SCALE_FACTOR,-1),2);
				effectedAreas.set(TOTAL_AREA_LABEL,[roundToDecimal(totalEffectAreaPercent,decimals=0), roundToDecimal(totalEffectAreaMM)]);
				return effectedAreas
			}

			//Construct a polygon from the left and right side of the lesion
			polygonCoordinates = leftSide.concat(rightSide);

			if (interpolationSettings != null) { 
				polygonCoordinates = catmullRomInterpolator(polygonCoordinates,interpolationSettings.splineAlpha,interpolationSettings.splineResolution, true);
			}
			lesionPolygon = contourToShape(polygonCoordinates);


			effectedAreas = calculateEffectedAreas(polygonCoordinates,e.data.templateData, e.data.interpolationSettings)
			
			return { effectedAreas : effectedAreas, lesionPolygon : polygonCoordinates, measurementTable : measurementTable, borders : borders };
		}


		let importedCoordinates = e.data.importedCoordinates;

		if ( e.data.sliceDepth > 0 ) {
			var temp = [];
			for ( var i = 0; i < importedCoordinates.length; i++) {
				temp[i*2] = importedCoordinates[i].slice();
				temp[i*2 +1] = importedCoordinates[i].slice();
				temp[i*2 +1][0] = temp[i*2 +1][0] +e.data.sliceDepth;
			}
			importedCoordinates = temp;
		}

		function postDebug(message) {
			debug.message =message;
			self.postMessage(debug);
		}

		var mapped = mapToRegions(importedCoordinates, e.data.templateData, e.data.size, e.data.bregmaLevelWidths, e.data.interpolationSettings );

	  	self.postMessage(mapped);

	}, false);
};

