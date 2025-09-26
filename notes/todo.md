# TO-DOs

[DONE] add endpoint to delete older files in media folder
[DONE] check and fix deprecation warning: [DEP0147] DeprecationWarning: In future versions of Node.js, fs.rmdir(path, { recursive: true }) will be removed. Use fs.rm(path, { recursive: true }) instead
[ ] fix Ken Burns calculations to take into account different a/r without breaking the videogeneration (again)
[DONE] refactor code, move functions to seperate files for each endpoint (and a helper-file perhaps) to clean up server.js
[ ] fix URL-construction bug (currently using hardcoded media path)
[DONE] refactor helper.js into smaller uility-files, create /helper subdir for those