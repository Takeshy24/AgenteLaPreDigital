@echo off
setlocal
set ROOT_DIR=%~dp0..\..
start "Open Browser" /B "%ROOT_DIR%\node.exe" "%ROOT_DIR%\out\server-cli.js" "code" "1.146.0" "69047191fc427f2f92828279aae1d90d8eeda7ab" "code.cmd" "--openExternal" "%*"
endlocal
