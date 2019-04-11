/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
var dataImporter = (function() {
'use strict';
	const EXPECTED_INPUT_COLUMNS = 4;
	const FILE_READER_JS_PATH = 'js/fileReaderWorker.js';

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

	//Transforms the textual contents of the csv uploaded by the user to an array of coordinates
	function csvToArray(csv, expectedColumns) {

		var results = [];
		var array = csv.split('\n');
		for ( var i=0; i < array.length; i++) {
			let currentRow = array[i].split(",");
			if ( currentRow.length == expectedColumns ) {
	
				currentRow = currentRow.map(function(item) { return parseFloat(item, 10);});
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
			if ( columns.length != EXPECTED_INPUT_COLUMNS) {
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
	function isValidInput(csv) {
		var valid = true;
		var rows = csv.split('\n');
		for ( var i = 0; i < rows.length-1; i++) {
			var columns = rows[i].split(',');
			if ( columns.length != EXPECTED_INPUT_COLUMNS) {
				return false;
			}
			for ( var j = 0; j < columns.length; j++) {
	
				if ( isNaN(columns[j]) || columns[j] == '') {
					return false;
				}
			}
		}
		return valid;
	}

	function importData(file, importFinishedCallback) {
		//Read the file asynchronously in a worker thread.
		var worker = new Worker(FILE_READER_JS_PATH);
		worker.postMessage(file);
		worker.addEventListener('message', function(e) {
			var csv = e.data;
			csv = trimEmptyLines(csv);
			var specified_coordinates = null; 
			if ( isValidInput(csv) )  {
				specified_coordinates = csvToArray(csv,EXPECTED_INPUT_COLUMNS);
			}
			importFinishedCallback(specified_coordinates);
			
		}, false);
	}

	return {
		importData : importData
	};
	

})();

module.exports = dataImporter;
