/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
self.addEventListener('message', function(e) {	
'use strict';
	var debug = {};

	var Y_ZERO = 532;
	var X_LEFT = 1770;
	var PIXELS_PER_UNIT = 75.625;

	//Maps the coordinates
	function mapToPixelLocations( coordinates, data, templateWidth, templateHeight, mode, shrinkageFactor ) {

		var trueYCoordinates = [];

		var mapping = {};
		mapping.mappedLocations = [];
		mapping.leftBorder = [];
		mapping.rightBorder = [];
		mapping.shrinkageFactor =  [];
		mapping.averageShrinkageFactor = [];
		var rightSide = [];
		var leftSide = [];

		for ( var i = 0; i < coordinates.length; i++ ) {
			var mValueSum = 0;

			var translatedY = Math.round( Y_ZERO - PIXELS_PER_UNIT*coordinates[i][0]);

			var nearestXLeft = findNearestBorder(translatedY, 0,data,templateWidth,templateHeight,1,3,"match");
			var nearestXRight = findNearestBorder(translatedY, X_LEFT,data,templateWidth,templateHeight,-1,215, "threshold");
				
			var width = nearestXRight[0] - nearestXLeft[0];

			for ( j = 1; j < coordinates[i].length; j++) {
				mValueSum +=  coordinates[i][j];
			}

			if ( mode == 0 ) {
				lesionLeft = Math.round (nearestXLeft[0] + ( (coordinates[i][3]) / mValueSum )*width / shrinkageFactor );
				lesionRight= Math.round ( lesionLeft + ( (coordinates[i][2])/ mValueSum )*width / shrinkageFactor);
			}
			else {
				lesionLeft = Math.round (nearestXLeft[0] +  (coordinates[i][3]*PIXELS_PER_UNIT) / shrinkageFactor);
				lesionRight= Math.round ( lesionLeft +  (coordinates[i][2]*PIXELS_PER_UNIT) / shrinkageFactor);
			}

			if (lesionLeft > nearestXRight[0] ) {
				lesionLeft = nearestXRight[0];
			}
			if (lesionRight < nearestXLeft[0]) {
				lesionRight = nearestXLeft[0];
			}

			leftSide.push( [ lesionLeft, translatedY] );
			rightSide.push( [ lesionRight, translatedY] );	

			mapping.leftBorder[i]  = [nearestXLeft[0], translatedY,lesionLeft];
			mapping.rightBorder[i] = [nearestXRight[0], translatedY,lesionRight];

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

		function findIndexOfNearest(value, source, extractor) {
			var minDistance = Number.MAX_VALUE;
			var currentDistance = Number.MAX_VALUE;
			var nearestIndex = 0;

			for ( var i = 0; i < source.length; i++) {
				currentDistance =  Math.abs(value - extractor(source,i));
				if ( currentDistance < minDistance) {
					minDistance = currentDistance;
					nearestIndex = i;
				} 			
			}
			var result = {};
			result.nearestIndex = nearestIndex;
			result.minDistance = minDistance;

			return result;
		}


		mapping.mappedLocations = leftSide.concat(rightSide);
		return mapping;
	}

	//Finds the coordinates of the nearest border in the given direction from a point specified.
	//In mode "match" borders are defined as pixels with a red intensity matching the given value.
	//In mode "threshold" borders are defiend as pixels which red intensity is above the given threshold.
	function findNearestBorder(y, start_x, data,width, height, direction, value, mode) {

		var MODE_MATCH = "match";
		var MODE_THRESHOLD = "threshold";

		for ( x = start_x; x < width && x >=0; x += direction) {
			var index = (y * width + x) * 4;
			if ( data[index] == value && mode == MODE_MATCH ) {
				return [x, y];
			} 
			if ( ( data[index] < value ) && mode == MODE_THRESHOLD ) {
				return [x, y];
			} 
		}
		return [0,0];
	}



	var importedCoordinates = e.data.importedCoordinates;

	if ( e.data.sliceDepth > 0 ) {
		var temp = [];
		for ( var i = 0; i < importedCoordinates.length; i++) {
			temp[i*2] = importedCoordinates[i].slice();
			temp[i*2 +1] = importedCoordinates[i].slice();
			temp[i*2 +1][0] = temp[i*2 +1][0] +e.data.sliceDepth;
		}
		importedCoordinates = temp;
	}

	var mapped = mapToPixelLocations(importedCoordinates, e.data.imageData, e.data.width, e.data.height, e.data.mode, e.data.shrinkageFactor );

  	self.postMessage(mapped);

}, false);


