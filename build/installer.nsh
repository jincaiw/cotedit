; Add CotEdit to the current user's Open With list without changing any default handler.
; The uninstall hook removes these entries only while this install still owns the command.

!macro CotEditOpenWithExtension EXT MODE
  !if "${MODE}" == "install"
    WriteRegNone HKCU "Software\Classes\.${EXT}\OpenWithProgids" "CotEdit.TextDocument"
    WriteRegStr HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".${EXT}" ""
  !else
    DeleteRegValue HKCU "Software\Classes\.${EXT}\OpenWithProgids" "CotEdit.TextDocument"
    DeleteRegValue HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".${EXT}"
  !endif
!macroend

!macro CotEditOpenWithExtensions MODE
  !insertmacro CotEditOpenWithExtension bib ${MODE}
  !insertmacro CotEditOpenWithExtension c ${MODE}
  !insertmacro CotEditOpenWithExtension c++ ${MODE}
  !insertmacro CotEditOpenWithExtension cc ${MODE}
  !insertmacro CotEditOpenWithExtension cls ${MODE}
  !insertmacro CotEditOpenWithExtension command ${MODE}
  !insertmacro CotEditOpenWithExtension conf ${MODE}
  !insertmacro CotEditOpenWithExtension cp ${MODE}
  !insertmacro CotEditOpenWithExtension cpp ${MODE}
  !insertmacro CotEditOpenWithExtension cs ${MODE}
  !insertmacro CotEditOpenWithExtension css ${MODE}
  !insertmacro CotEditOpenWithExtension cxx ${MODE}
  !insertmacro CotEditOpenWithExtension d ${MODE}
  !insertmacro CotEditOpenWithExtension dart ${MODE}
  !insertmacro CotEditOpenWithExtension dif ${MODE}
  !insertmacro CotEditOpenWithExtension diff ${MODE}
  !insertmacro CotEditOpenWithExtension dtd ${MODE}
  !insertmacro CotEditOpenWithExtension f ${MODE}
  !insertmacro CotEditOpenWithExtension f03 ${MODE}
  !insertmacro CotEditOpenWithExtension f08 ${MODE}
  !insertmacro CotEditOpenWithExtension f90 ${MODE}
  !insertmacro CotEditOpenWithExtension f95 ${MODE}
  !insertmacro CotEditOpenWithExtension for ${MODE}
  !insertmacro CotEditOpenWithExtension geojson ${MODE}
  !insertmacro CotEditOpenWithExtension go ${MODE}
  !insertmacro CotEditOpenWithExtension h ${MODE}
  !insertmacro CotEditOpenWithExtension h++ ${MODE}
  !insertmacro CotEditOpenWithExtension hh ${MODE}
  !insertmacro CotEditOpenWithExtension hp ${MODE}
  !insertmacro CotEditOpenWithExtension hpp ${MODE}
  !insertmacro CotEditOpenWithExtension hs ${MODE}
  !insertmacro CotEditOpenWithExtension htm ${MODE}
  !insertmacro CotEditOpenWithExtension html ${MODE}
  !insertmacro CotEditOpenWithExtension hxx ${MODE}
  !insertmacro CotEditOpenWithExtension ini ${MODE}
  !insertmacro CotEditOpenWithExtension ipp ${MODE}
  !insertmacro CotEditOpenWithExtension jav ${MODE}
  !insertmacro CotEditOpenWithExtension java ${MODE}
  !insertmacro CotEditOpenWithExtension jl ${MODE}
  !insertmacro CotEditOpenWithExtension js ${MODE}
  !insertmacro CotEditOpenWithExtension json ${MODE}
  !insertmacro CotEditOpenWithExtension kt ${MODE}
  !insertmacro CotEditOpenWithExtension kts ${MODE}
  !insertmacro CotEditOpenWithExtension lhs ${MODE}
  !insertmacro CotEditOpenWithExtension lisp ${MODE}
  !insertmacro CotEditOpenWithExtension lsp ${MODE}
  !insertmacro CotEditOpenWithExtension lua ${MODE}
  !insertmacro CotEditOpenWithExtension markdown ${MODE}
  !insertmacro CotEditOpenWithExtension md ${MODE}
  !insertmacro CotEditOpenWithExtension mdown ${MODE}
  !insertmacro CotEditOpenWithExtension mkd ${MODE}
  !insertmacro CotEditOpenWithExtension mkdn ${MODE}
  !insertmacro CotEditOpenWithExtension mojo ${MODE}
  !insertmacro CotEditOpenWithExtension mysql ${MODE}
  !insertmacro CotEditOpenWithExtension patch ${MODE}
  !insertmacro CotEditOpenWithExtension pgsql ${MODE}
  !insertmacro CotEditOpenWithExtension php ${MODE}
  !insertmacro CotEditOpenWithExtension php3 ${MODE}
  !insertmacro CotEditOpenWithExtension php4 ${MODE}
  !insertmacro CotEditOpenWithExtension php5 ${MODE}
  !insertmacro CotEditOpenWithExtension phps ${MODE}
  !insertmacro CotEditOpenWithExtension phtml ${MODE}
  !insertmacro CotEditOpenWithExtension pl ${MODE}
  !insertmacro CotEditOpenWithExtension pm ${MODE}
  !insertmacro CotEditOpenWithExtension py ${MODE}
  !insertmacro CotEditOpenWithExtension pyw ${MODE}
  !insertmacro CotEditOpenWithExtension rb ${MODE}
  !insertmacro CotEditOpenWithExtension rc ${MODE}
  !insertmacro CotEditOpenWithExtension rest ${MODE}
  !insertmacro CotEditOpenWithExtension rs ${MODE}
  !insertmacro CotEditOpenWithExtension rst ${MODE}
  !insertmacro CotEditOpenWithExtension scala ${MODE}
  !insertmacro CotEditOpenWithExtension scm ${MODE}
  !insertmacro CotEditOpenWithExtension sh ${MODE}
  !insertmacro CotEditOpenWithExtension sql ${MODE}
  !insertmacro CotEditOpenWithExtension ss ${MODE}
  !insertmacro CotEditOpenWithExtension sty ${MODE}
  !insertmacro CotEditOpenWithExtension svg ${MODE}
  !insertmacro CotEditOpenWithExtension swift ${MODE}
  !insertmacro CotEditOpenWithExtension tex ${MODE}
  !insertmacro CotEditOpenWithExtension textile ${MODE}
  !insertmacro CotEditOpenWithExtension toml ${MODE}
  !insertmacro CotEditOpenWithExtension txt ${MODE}
  !insertmacro CotEditOpenWithExtension v ${MODE}
  !insertmacro CotEditOpenWithExtension vhd ${MODE}
  !insertmacro CotEditOpenWithExtension xml ${MODE}
  !insertmacro CotEditOpenWithExtension xsd ${MODE}
  !insertmacro CotEditOpenWithExtension xsl ${MODE}
  !insertmacro CotEditOpenWithExtension xslt ${MODE}
  !insertmacro CotEditOpenWithExtension yaml ${MODE}
  !insertmacro CotEditOpenWithExtension yml ${MODE}
!macroend

!macro customInstall
  WriteRegStr HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  WriteRegStr HKCU "Software\Classes\CotEdit.TextDocument" "" "Text document"
  WriteRegStr HKCU "Software\Classes\CotEdit.TextDocument\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\CotEdit.TextDocument\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\CotEdit.TextDocument\shell\open" "" "Open with CotEdit"
  WriteRegStr HKCU "Software\Classes\CotEdit.TextDocument\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  !insertmacro CotEditOpenWithExtensions install
!macroend

!macro customUnInstall
  Push $R0
  Push $R1
  StrCpy $R0 "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  ReadRegStr $R1 HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" ""
  StrCmp $R1 $R0 cotedit_cleanup_matches cotedit_cleanup_done
cotedit_cleanup_matches:
  !insertmacro CotEditOpenWithExtensions uninstall
  DeleteRegKey HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  DeleteRegKey HKCU "Software\Classes\CotEdit.TextDocument"
cotedit_cleanup_done:
  Pop $R1
  Pop $R0
!macroend
