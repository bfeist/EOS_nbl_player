var gulp = require('gulp'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    // sass = require('gulp-ruby-sass'),
    sourcemaps = require('gulp-sourcemaps'),
    autoprefixer = require('gulp-autoprefixer'),
    browserSync = require('browser-sync').create();

var DEST = '_webroot/';

// gulp.task('scripts', function() {
//     return gulp.src([
//         'src/js/helpers/*.js',
//         'src/js/*.js',
//       ])
//       .pipe(uglify())
//       .pipe(gulp.dest(DEST+'/js'))
//       .pipe(browserSync.stream());
// });


gulp.task('scripts', function () {
    return gulp.src([
        'src/js/helpers/*.js',
        'src/js/*.js',
        ])
        .pipe(sourcemaps.init())
        .pipe(concat('custom.js'))
        .pipe(sourcemaps.write('maps'))
        .pipe(gulp.dest(DEST + '/js'))
        // .pipe(rename({suffix: '.min'}))
        // .pipe(uglify())
        // .pipe(gulp.dest(DEST+'/js'))
        .pipe(browserSync.stream());
});


// TODO: Maybe we can simplify how sass compile the minify and unminify version
var compileSASS = function (filename, options) {
    return sass('src/scss/*.scss', options)
        .pipe(autoprefixer('last 2 versions', '> 5%'))
        .pipe(concat(filename))
        .pipe(gulp.dest(DEST + '/css'))
        .pipe(browserSync.stream());
};

gulp.task('sass', function () {
    return compileSASS('custom.css', {});
});

gulp.task('sass-minify', function () {
    return compileSASS('custom.min.css', {style: 'compressed'});
});

gulp.task('html', function () {
    return gulp.src([
        'src/*.html'
    ])
        .pipe(gulp.dest(DEST))
        .pipe(browserSync.stream());
});

gulp.task('browser-sync', function () {
    browserSync.init({
        injectChanges: true,
        port: 3001,
        open: true,
        proxy: 'nbl3.develop',
        notify: {
            styles: {
                top: 'auto',
                bottom: '0'
            }
        },
        startPath: '/nblvisualizer_v3.html'
    });
});

gulp.task('watch', function () {
    // Watch .html files
    gulp.watch('src/*.html', ['html']);
    // Watch .js files
    gulp.watch('src/js/*.js', ['scripts']);
    // Watch .scss files
    gulp.watch('src/scss/*.scss', ['sass', 'sass-minify']);
});

// Default Task
gulp.task('default', ['browser-sync', 'watch']);