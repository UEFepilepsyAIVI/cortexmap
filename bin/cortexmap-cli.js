#! /usr/bin/env node
'use strict';

const puppeteer = require('puppeteer');    

const program = require('commander')
const fs = require('fs');
const path = require('path');
var RGBColor = require('rgbcolor');
var gulp = require('gulp');

var spawn = require('child_process').spawn;

function cli()  {

  const OUTPUT_IMAGE_NAME = "cortexmap_images.zip";
  const OUTPUT_AREAS_NAME = "areas.csv";
  const DEFAULT_TIMEPOINT = "0";

  program
    .version('1.0.2')
    .option('-m, --measurements <path>', 'Measurement file or folder')
    .option('-t, --timepoints <timepoints>', 'Measurement file or folder')
    .option('-o, --output-path <path>', 'Output path')
    .option('-b, --border-color [bcolor]', 'Border color')
    .option('-f, --fill-color [acolor]', 'Area color')
    .option('-w, --border-width [width]', 'Border width')  
    .option('-m, --map [map]', 'Map template SVG')  
    .option('-d, --dpi [dpi]', 'Image DPI')  
    .parse(process.argv);


  async function fileDownloaded(downloadedFilePath){
    return new Promise(resolve => {
      var delInterval = setInterval(
        function (){

          fs.open(downloadedFilePath, 'r+', function(err, fd){
              if (!err) {
                  fs.close(fd, function(){       
                    clearInterval(delInterval);
                    resolve();
                  });
              }
          });
      }
      , 
      1);    
    });
  };

  function getColorCode(colorString) {
    return "rgba(" + colorString + ")"; 
  }


  function valuesDuplicated(array) {
    return (new Set(array)).size !== array.length;
  }


  function processMeasurements(measurements, timePoints, outputPath, overrides) {

    let measurementData = measurements.split(',');
    let isTimeseries = false;

    if ( valuesDuplicated(measurementData)) {
      console.log("ERROR: Duplicated measurement file.");
      return;
    }

    if ( timePoints !== undefined ) {
      timePoints = timePoints.split(',');
      isTimeseries = true;
      if ( valuesDuplicated(timePoints) ) {
        console.log("ERROR: Duplicated timepoint.");
        return;
      }      
    }
    else {
      timePoints = [];
      measurementData.forEach((x)=> { timePoints.push(DEFAULT_TIMEPOINT)});
    }

    measurementData = measurementData.map( (value, index) => {
      return [value,timePoints[index]];
    });

    let directory = false;  
    if ( measurementData.length == 1 ) {
      try {
        directory = fs.lstatSync(measurementData[0][0]).isDirectory()
      }
      catch(err){
        console.log("Invalid path: " + measurementData[0][0])
        return;
      } 
    }
 
    (async() => {    
  
    if ( directory ) {
      fs.readdir(measurements,  async (err, files) => {
          for (const file of files) { 
            await  processFile([path.resolve(measurements,file)]);
          }
          finish();
      });
    }
    else {
      
      if ( isTimeseries ) {
        await processFile(measurementData);
      }
      else {
        for (const dataEntry of measurementData ) {
          await processFile([dataEntry]);
        };
      }

      finish();
    }

    async function processFile( measurementPath){

      const browser = await puppeteer.launch({headless:true,args:['--allow-file-access-from-files']});
  
      const page = await browser.newPage();  
  
      await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: outputPath});
      let indexPath = path.resolve(__dirname, '..','dist/index.html');
  
      page.goto("file://" +indexPath);  
  
      await page.waitForSelector('#mapColumn',{visible:true})

      await page.evaluate((overrides) => {
  
        window.CortexMapOverrides  = overrides;
      
      }, overrides);

      for ( const file of measurementPath ) {

        var filePath = path.parse(file[0]);
        console.log("\t" + file[0]);

        let fileSelected = false;
        while(!fileSelected) {
          try {
            const [fileChooser] = await Promise.all([
              page.waitForFileChooser({timeout:1000}),
              page.click('#upload'), 
            ]);
            await fileChooser.accept([file[0]]);

            fileSelected = true;
          }
          catch( err ) {
            
          }
        }

        await page.waitForSelector('#importModal',{visible:true})
        await page.type('#timeInput', file[1], {delay: 20})
        await page.click("#importCoordinatesButton");
        await page.keyboard.press('Escape');
        await page.waitForSelector('#importModal',{hidden:true})
      }

      let imagesDownloaded = false;
      await page.waitForSelector("#saveImage",{visible:true});
      await page.click("#saveImage");
      while ( !imagesDownloaded ) {
        try {
          await page.click("#saveImage");
          await page.waitForSelector(".modalProgressBar",{visible:true,timeout:1000});  
          await page.waitForSelector(".modalProgressBar",{hidden:true,timeout:1000});  
          imagesDownloaded = true;
        }
        catch(err) {

        }

      }

      function renameFile(originalFileName, postFix) {
        fs.rename(outputPath + originalFileName, outputPath + filePath.base + postFix, function(err) {
          if ( err ) console.log('ERROR: ' + err);
        });
      };

      await fileDownloaded(outputPath + OUTPUT_IMAGE_NAME);
      renameFile(OUTPUT_IMAGE_NAME,".zip");

      await page.waitForSelector("#saveTable",{visible:true});  

      await page.click("#saveTable");

      await fileDownloaded(outputPath + OUTPUT_AREAS_NAME);      
      renameFile(OUTPUT_AREAS_NAME,".csv");

      await browser.close();   
    }

    async function finish() {
 
      console.log("Completed.");  
    }
  
    })();

  }

  if (!program.measurements) {
    console.log("No measurements provided.");
    return;  
  }

  if (!program.outputPath) {
    console.log("No output path specified");
    return;
  }

  let fillColor = program.fillColor;
  let borderColor = program.borderColor;

  try {
    fillColor = fillColor ? new RGBColor(program.fillColor) : program.fillColor;
  }
  catch(err) {
    console.log("Invalid fill color.");
  }

  try {
    borderColor = borderColor ? new RGBColor(program.borderColor) : program.borderColor; 
  }
  catch(err) {
    console.log("Invalid border color.");
  }

  if (program.borderWidth && ( program.borderWidth < 1 || program.borderWidth > 20))  {
    console.log("Borderwidth should be");
    return;
  }

  if (
        program.borderStyle && (
        program.borderStyle != "solid" || 
        program.borderStyle != "dashed" || 
        program.borderStyle != "dotted"
        ) 
      )  {
    console.log("Invalid border style. Accepted values: solid, dashed, dotted.");
    return;
  }

  if ( program.template && 
        ( 
          typeof program.template == "string" || 
          !fs.existsSync(__dirname + "../src/data/" + program.template + "/bregma_level_widths.json") || 
          !fs.existsSync(__dirname + "../src/data/" + program.template.toLowerCase() +'/' + program.template.toLowerCase() + '_map.svg')
        ) ) {
    console.log("Template " + program.template + " does not exist.");
    return;
  }

  let CortexMapOverrides = {};
  CortexMapOverrides.fillColor = program.fillColor ? getColorCode(program.fillColor) : false;
  CortexMapOverrides.borderColor = program.borderColor ? getColorCode(program.borderColor) : false;
  CortexMapOverrides.borderWidth = program.borderWidth ? parseInt(program.borderWidth) : false;
  CortexMapOverrides.borderStyle = program.borderStyle ? program.borderStyle : false;
  CortexMapOverrides.animal = program.template ? program.template : false;
  CortexMapOverrides.dpi = program.dpi ? parseInt(program.dpi) : false;




  if (fs.existsSync(program.outputPath)) {
    console.log("Processing files:")
    processMeasurements(program.measurements, program.timepoints,program.outputPath, CortexMapOverrides);  
  }
  else{
    console.log("Output path does not exist.");
  }
}

function buildApp() { 

    var cwd = process.env.PWD || process.cwd();

    var gulpProc = spawn('gulp', ['--silent','build-only'], {
      stdio: 'inherit',
      cwd: cwd
    });
  
    gulpProc.on('close', function (code) {
      console.log("Build finished.")  
      cli();
      process.exit(code);
    });
}

process.chdir(__dirname + '/../');

if (!fs.existsSync(path.resolve(__dirname, '..','dist'))) {
  console.log("Folder dist/ empty. Building Cortexmap web app.")  
  buildApp();
}
else {
  cli();
}





