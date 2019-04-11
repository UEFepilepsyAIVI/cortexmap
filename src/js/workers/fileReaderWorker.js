/*
Author: Robert Ciszek
Contact: ciszek@uef.fi
*/
self.addEventListener('message', function(e) {	

	importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.11.13/xlsx.full.min.js'); 

	var file = e.data;
	var extension = file.name.split('.').pop();
	var csv = [];

	var onload = function(e){
		var data = e;
		var specified_coordinates = [];
		var workbook = null;
		if (extension == 'xlsx') {
			workbook = XLSX.read(data, {type : 'binary'});
			csv = XLSX.utils.sheet_to_csv (workbook.Sheets[workbook.SheetNames[0]]);	

		}
		if (extension == 'xls') {
			workbook = XLS.read(data, {type : 'binary'});
			csv = XLS.utils.sheet_to_csv (workbook.Sheets[workbook.SheetNames[0]]);	
		}
		if (extension == 'csv') {
			csv = data;
		}

	};

    self.readAsBinaryString = function(blob, callback) {
        var reader = new FileReaderSync();

        var binStringCallback = function (e) {
            callback(e);
        };

        var arrBufferCallback = function (e) {
            var binary = "";
            var bytes = new Uint8Array(e);
            var length = bytes.byteLength;
            for (var i = 0; i < length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            callback(binary);
        };

	var data = null;
        if (typeof reader.readAsBinaryString != "undefined") {
            data = reader.readAsBinaryString(blob);
			binStringCallback(data);
        } else {
            data = reader.readAsArrayBuffer(blob);
			arrBufferCallback(data);
        }
    };
	self.readAsBinaryString(file, onload);	
	
  	self.postMessage( csv);

}, false);


