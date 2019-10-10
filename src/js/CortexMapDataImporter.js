/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
var dataImporter = (function() {
'use strict';
	const EXPECTED_COLUMNS = 4;
	const LESION = "lesion";
	const ELECTRODE = "electrode";
	const FILE_READER_JS_PATH = 'js/fileReaderWorker.js';

	//Transforms the textual contents of the csv uploaded by the user to an array of coordinates
	function csvToArray(csv, format) {
		let expectedColumns = EXPECTED_COLUMNS;

		var results = [];
		var array = csv.split('\n');
		for ( var i=0; i < array.length; i++) {
			let currentRow = array[i].split(",");
			if ( currentRow.length == expectedColumns ) {
	

				currentRow = currentRow.map(function(item, index) { 
					if ( format == ELECTRODE && index == EXPECTED_COLUMNS-1) {
						return item;
					}
					else {
						return parseFloat(item, 10);
					}

				});

				results[results.length] = currentRow;
			}
		}
		return results;
	}

	//Removes possible empty lines from the csv
	function trimEmptyLines(csv) {
		var trimmed = [];
		var rows = csv.split('\n');
		var trimmedCSV = "";

		for ( let i = 0; i < rows.length-1; i++) {
			var columns = rows[i].split(',');
			if ( columns.length != EXPECTED_COLUMNS ) {
				return csv;
			}
			var empty = 0;
			for ( let j = 0; j < columns.length; j++) {
	
				if ( isNaN(columns[j]) ) {
					return csv;
				}
				if ( columns[j] == '' ) {
					empty++;
				}
			}
			if (empty == 0) {
				trimmed.push(columns);
			}
		}
		
		for ( let i = 0; i < trimmed.length; i++) {
			for ( let j = 0; j < trimmed[0].length; j++) {
				trimmedCSV = trimmedCSV + trimmed[i][j];
				if ( j < trimmed[0].length-1 ) {
					trimmedCSV =  trimmedCSV + ",";
				}
			}
			trimmedCSV =  trimmedCSV + "\r\n";
		}		
		
		return trimmedCSV;
	}

	//Checks if the input is in the expected format
	function determineFormat(csv) {
		var format = "invalid";
		var rows = csv.split('\n');
		for ( var i = 0; i < rows.length-1; i++) {
			var columns = rows[i].split(',');
			if ( columns.length != EXPECTED_COLUMNS ) {
				return "invalid";
			}
			for ( var j = 0; j < columns.length; j++) {
				if ( (isNaN(columns[j]) && j != EXPECTED_COLUMNS -1) || columns[j] == '') {
					return "invalid";
				}
			}
			if ( columns[EXPECTED_COLUMNS-1].match(/[a-z]/i)) {
				format = "electrode";
			}
			else {
				format = "lesion";
			}			
		}
		return format;
	}

	function importData(file, importFinishedCallback) {
		//Read the file asynchronously in a worker thread.
		var worker = new Worker(FILE_READER_JS_PATH);
		worker.postMessage(file);
		worker.addEventListener('message', function(e) {
			var csv = e.data;
			csv = trimEmptyLines(csv);
			var specified_coordinates = null; 
			let format = determineFormat(csv);
			if (format)  {
				specified_coordinates = csvToArray(csv,format);
			}		
			importFinishedCallback(specified_coordinates, format);
		}, false);
	}

	return {
		importData : importData
	};
	

})();

module.exports = dataImporter;
