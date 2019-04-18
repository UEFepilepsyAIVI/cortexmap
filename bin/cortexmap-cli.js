#! /usr/bin/env node
'use strict';

const puppeteer = require('puppeteer');    
const testFolder = './';
const program = require('commander')
const fs = require('fs');
const path = require('path');
var RGBColor = require('rgbcolor');
var gulp = require('gulp');

var spawn = require('child_process').spawn;

function cli()  {

  const OUTPUT_IMAGE_NAME = "mapped.tiff";
  const OUTPUT_AREAS_NAME = "areas.csv";

  program
    .version('1.0.0')
    .option('-m, --measurements <path>', 'Measurement file or folder')
    .option('-o, --output-path <path>', 'Output path')
    .option('-b, --border-color [bcolor]', 'Border color')
    .option('-f, --fill-color [acolor]', 'Area color')
    .option('-w, --border-width [width]', 'Border width')  
    .option('-t, --template [template]', 'Template SVG')  
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


  function processMeasurements(measurements, outputPath, overrides) {

    let directory = false;  
    try {
      directory = fs.lstatSync(measurements).isDirectory()
    }
    catch(err){
      console.log("Invalid path: " + measurements)
      return;
    }  
    
    (async() => {    
    
    const browser = await puppeteer.launch({headless:false,args:['--allow-file-access-from-files']});
    const page = await browser.newPage();  
      
    await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: outputPath});

    page.goto('file:///home/user/Projects/CortexMap/Cortexmap_mouse/dist/index.html')  
    
    await page.waitForSelector('#mapColumn',{visible:true})

    await page.evaluate((overrides) => {

      window.CortexMapOverrides  = overrides;
    
    }, overrides);


    if ( directory ) {
      fs.readdir(testFolder, (err, files) => {
        for (const file of files) {
          processFile(page,file);
        }
      });
    }
    else {
      await processFile(page, measurements);
    }

    async function processFile(page, measurementPath){

      var filePath = path.parse(measurementPath);
      console.log("\t" + measurementPath);

      await page.click("#upload");
      const fileUploaders = await page.$$("input[type=file]");
      
      fileUploaders[0].uploadFile(measurementPath)
      await page.waitForSelector('#importModal',{visible:true})
      await page.click("#importCoordinatesButton");
      await page.keyboard.press('Escape');

      await page.waitForSelector("#saveImage",{visible:true});
      await page.click("#saveImage");


      function renameFile(originalFileName, postFix) {
        fs.rename(outputPath + originalFileName, outputPath + filePath.base + postFix, function(err) {
          if ( err ) console.log('ERROR: ' + err);
        });
      };

      await fileDownloaded(outputPath + OUTPUT_IMAGE_NAME);

      renameFile(OUTPUT_IMAGE_NAME,".tiff");

      await page.click("#saveTable");
      await page.waitForSelector('#downloadTableListItem',{visible:true})
      await page.click("#downloadTableListItem");
      await fileDownloaded(outputPath + OUTPUT_AREAS_NAME);
      renameFile(OUTPUT_AREAS_NAME,".csv");
          
    }

    await browser.close();    
    console.log("Completed.")    
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

  let fillColor = new RGBColor(program.fillColor);
  let borderColor = new RGBColor(program.borderColor);

  console.log(fillColor);

  if (!fillColor) {
    console.log("Invalid fill color.");
    return;
  }

  if (!borderColor) {
    console.log("Invalid border color.");
    return;
  }

  if (borderWidth < 1 || borderWidth > 20) {
    console.log("Borderwidth should be");
    return;
  }

  if (borderStyle != "solid" || borderStyle != "dashed" || borderStyle != "dotted") {
    console.log("Invalid border style. Accepted values: solid, dashed, dotted.");
    return;
  }

  if ( typeof template == "string" || 
        !fs.existsSync(__dirname + "../src/data/" + template + "/bregma_level_widths.json") || 
        !fs.existsSync(__dirname + "../src/data/" + template.toLowerCase() +'/' + template.toLowerCase() + '_map.svg') ) {
    console.log("Template " + template + " does not exist.");
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
    processMeasurements(program.measurements, program.outputPath, CortexMapOverrides);  
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





