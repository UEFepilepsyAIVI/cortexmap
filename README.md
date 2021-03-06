# CortexMap
The localization of traumatic brain injury (TBI) lesions directly correlates with motor disabilities and cognitive impairment. By unfolding magnetic resonance (MR) images of a lesioned rat cortex on a two-dimensional (2D) cytoarchitecture map of the cortex, it is possible to predict the severity of the resulting cognitive and behavioral impairment.

CortexMap is a web application to estimate the location of the lesion on mouse cerebral cortex caused by TBI induced by lateral fluid-percussion injury. The application unfolds user-determined TBI lesion measurements, e.g., from histologic sections to a reference template, and estimates the total lesion area, including the percentage of cortex damaged in different cytoarchitectural cortical regions.

For off-line use, CortexMap is also available as a command-line application.


## Web application
The web application is available at [www.cortexmap.org](https://www.cortexmap.org)


## Command-line application
### Installation

#### Step 1: Install Node.js

*Windows:*

Download [Node.js installer](https://nodejs.org/en/). Execute the installation wizard.

*Linux/macOS:*

Follow the [official instructions](https://nodejs.org/en/download/package-manager/)

#### Step 2: Install cortexmap-cli
After Node.js has been installed, type:
```
npm install cortexmap-cli -g
```

### Command-line parameters
|Parameter	| Description |
|:----------|:------------|
|-m, --measurements| Path to the measurement file, comma separated list of measurement file paths, or path to a folder containing measurements.|
|-o, --output-path|	Output folder for mappings and area measurements. *Optional.*|
|-t, --timepoints|	Comma separated list of measurement timepoints as integeres *Optional.*|
|-b, --border-color|	Lesion border color as RGBA quadruplet, e.g. 0,0,255,1.  *Optional.*|
|-f, --fill-color|	Lesion fill color as RGBA quadruplet, e.g. 0,0,255,1.  *Optional.*|
|-w, --border-width|	Lesion border width as an integer value between 1 and 20.  *Optional.*|
|-s, --border-style|	Lesion border style. Accepted values are “solid”, “dashed” or “dotted”.  *Optional.*|
|-d, --dpi|	Output image dpi. *Optional.*|
|-c, --cortexmap|	Path to the cortex map template used in mapping. *Optional.*|


### Example usage
Mapping a single measurement:
```
cortexmap-cli -m ./measurements/001_day_1.csv -o ./mapping-results/
```

Mapping a time series of measurements:
```
cortexmap-cli -m ./measurements/001_day_1.csv,./measurements/001_day_7.csv,./measurements/001_day_14.csv \
-o ./mapping-results/
```

Mapping a time series of measurements, with blue fill color:
```
cortexmap-cli -m ./measurements/001_day_1.csv,./measurements/001_day_7.csv,./measurements/001_day_14.csv \
-f 255,0,0,1 \
-o ./mapping-results/
```
