; Edita installer hooks (used by Tauri's NSIS installer, see src-tauri/tauri.conf.json).

; Uninstall: removes what Tools > "Make Edita the Default Text Editor" registered for the current user.
!macro EditaRemoveOpenWith EXT
  DeleteRegValue HKCU "Software\Classes\.${EXT}\OpenWithProgids" "Edita.File"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Edita.File"
  DeleteRegKey HKCU "Software\Classes\Applications\Edita.exe"
  DeleteRegKey HKCU "Software\Edita"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Edita"
  !insertmacro EditaRemoveOpenWith "txt"
  !insertmacro EditaRemoveOpenWith "log"
  !insertmacro EditaRemoveOpenWith "ini"
  !insertmacro EditaRemoveOpenWith "md"
  !insertmacro EditaRemoveOpenWith "ino"
  !insertmacro EditaRemoveOpenWith "c"
  !insertmacro EditaRemoveOpenWith "h"
  !insertmacro EditaRemoveOpenWith "cpp"
  !insertmacro EditaRemoveOpenWith "hpp"
  !insertmacro EditaRemoveOpenWith "py"
  !insertmacro EditaRemoveOpenWith "java"
  !insertmacro EditaRemoveOpenWith "js"
  !insertmacro EditaRemoveOpenWith "json"
  !insertmacro EditaRemoveOpenWith "html"
  !insertmacro EditaRemoveOpenWith "htm"
  !insertmacro EditaRemoveOpenWith "css"
  !insertmacro EditaRemoveOpenWith "php"
  !insertmacro EditaRemoveOpenWith "rs"
  !insertmacro EditaRemoveOpenWith "vb"
  !insertmacro EditaRemoveOpenWith "asm"
  !insertmacro EditaRemoveOpenWith "s"
!macroend
