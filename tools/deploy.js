const { execSync } = require('child_process');
const gulp = require('gulp');
const { rmSync } = require('fs');

function clean(cb) {
  rmSync('dist', { recursive: true, force: true });
  cb();
}

function build(cb) {
  execSync(
    'npx nx run-many -t build -p frontend backend --configuration=production --skip-nx-cache',
    {
      stdio: 'inherit',
    },
  );
  cb();
}

gulp.task('deploy', gulp.series(clean, build));
