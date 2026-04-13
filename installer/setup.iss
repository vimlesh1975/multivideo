; Inno Setup Script for Multivideo CasparCG Controller
; You must have Inno Setup installed to compile this script.

[Setup]
AppName=Multivideo CasparCG Controller
AppVersion=1.0
DefaultDirName={autopf}\MultivideoCasparCG
DefaultGroupName=Multivideo CasparCG
OutputBaseFilename=MultivideoControllerSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin

[Files]
; Standalone build contents (from .next/standalone after running 'npm run build')
Source: "..\.next\standalone\*"; DestDir: "{app}"; Flags: igonreversion recursesubdirs createallsubdirs
; Static and public files (must be copied manually in standalone mode)
Source: "..\.next\static\*"; DestDir: "{app}\.next\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
; WinSW wrapper and config (must run download-winsw.ps1 first)
Source: "..\winsw\multivideo-service.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\winsw\multivideo-service.xml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\winsw\node.exe"; DestDir: "{app}"; Flags: ignoreversion

[Run]
; Install and start the service
Filename: "{app}\multivideo-service.exe"; Parameters: "install"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated
Filename: "{app}\multivideo-service.exe"; Parameters: "start"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated

[UninstallRun]
; Stop and remove the service
Filename: "{app}\multivideo-service.exe"; Parameters: "stop"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated
Filename: "{app}\multivideo-service.exe"; Parameters: "uninstall"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated

[Icons]
Name: "{group}\Multivideo UI"; Filename: "http://127.0.0.1:15000"
Name: "{group}\Uninstall Multivideo"; Filename: "{uninstallexe}"
