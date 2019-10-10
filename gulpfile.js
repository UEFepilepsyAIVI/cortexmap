//Author: rciszek
const gulp = require('gulp');
const useref = require('gulp-useref');
const uglifyes = require('uglify-es');
const composer = require('gulp-uglify/composer');
const uglify = composer(uglifyes, console);
const htmlmin = require('gulp-htmlmin');
const gulpIf = require('gulp-if');
const cssnano = require('gulp-cssnano');
const del = require('del');
const runSequence = require('run-sequence');
const changed = require('gulp-changed');
const jshint = require('gulp-jshint');
const browserSync = require('browser-sync').create();
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const inject = require('gulp-inject')
const webserver = require('gulp-webserver');
const concat = require('gulp-concat');
const merge = require('merge-stream');
const babel = require('gulp-babel');

const SRC = 'src/';
const DEST = './dist/';
const IMG = 'img/'

const LIBS = 'src/js/libs/'
const DATA = 'data/'
const WORKERS = 'js/workers/'
const BROWSERIFY_ENTRY = 'js/CortexMapGUI.js'
const TEST = 'test/'

gulp.task('lint', function() {
	return gulp.src(SRC + 'js/*.js')
	.pipe(jshint())
	.pipe(jshint.reporter('jshint-stylish'));
})

gulp.task('watch', function() {
	gulp.watch( SRC+'**/*.*',['lint']);
});

gulp.task('browserify-and-uglify', function() {
	return merge( 
			//Browserify and uglify npm packages
			browserify(SRC+BROWSERIFY_ENTRY)
			.bundle()
			.pipe(source('bundle.js'))
			.pipe(buffer())
			.pipe(babel({presets: ['env']}))
			.pipe(uglify())
			,	
			//Uglify other dependencies
			gulp.src(LIBS +'*.js')
			.pipe(babel({presets: ['env']}))
			.pipe(uglify())
		)
		.pipe(concat('bundle.js'))
		.pipe(gulp.dest(DEST + "js/"));	

});gulp

gulp.task('minify-workers', function() {
	return gulp.src(SRC + WORKERS + '*.js')
	.pipe(uglify())
	.pipe(gulp.dest(DEST + "js/"));
});

gulp.task('copy-data', function() {
	return gulp.src(SRC + DATA +"**/*.*")
	.pipe(changed(DEST + DATA))
	.pipe(gulp.dest(DEST + DATA))
});

gulp.task('copy-img', function() {
        return gulp.src(SRC + IMG +"**/*.*")
        .pipe(changed(DEST + IMG))
        .pipe(gulp.dest(DEST + IMG))
});


gulp.task('copy-test', function() {
	return gulp.src(TEST + "**/*.*")
	.pipe(changed(DEST ))
	.pipe(gulp.dest(DEST))
})

gulp.task('deploy', function() {
	return gulp.src(DEST + "**/*.*")
	.pipe(changed(DEPLOY))
	.pipe(gulp.dest(DEPLOY))
})


gulp.task('minify-html-css', function () {

    return gulp.src(SRC+'*.html')
        .pipe(useref())
				.pipe(gulpIf('*.css', cssnano()))
				.pipe(gulpIf('*.html',inject(gulp.src('js/bundle.js', {read: false, cwd: __dirname + '/dist'}),{addRootSlash:false})))
				.pipe(gulpIf('*.html', htmlmin({collapseWhitespace:true})))
        .pipe(gulp.dest(DEST));
});


gulp.task('clean', function() {
	return del.sync(DEST)
})

gulp.task('browserSync', function() {
	browserSync.init( {
		server: {
			baseDir: DEST

		},
	})
});

gulp.task('webserver', function() {
  gulp.src(DEST)
    .pipe(webserver({
      livereload: true,
      directoryListing: false,
      open: true,

    }));
});

gulp.task('browserify-test', function() {
    return gulp.src(TEST + "*.js")
        .pipe(browserify())
        .pipe(gulp.dest(DEST))
});

gulp.task('build', function(callback) {
	runSequence('clean','copy-data', 'copy-img','browserify-and-uglify', 'minify-html-css', 'minify-workers','webserver', callback);
});

gulp.task('build-only', function(callback) {
	console.log(process.cwd())
	runSequence('clean','copy-data', 'copy-img','browserify-and-uglify', 'minify-html-css', 'minify-workers', callback);
});

gulp.task('test', function(callback) {
	runSequence('clean','copy-test', 'copy-img','browserify-test','webserver', callback);
});
