Option Explicit

Dim shell, fileSystem, gameRoot, command, waitForExit, exitCode
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

gameRoot = fileSystem.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = gameRoot
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & gameRoot & "\tools\start-game.ps1"""
waitForExit = (shell.ExpandEnvironmentStrings("%YEONGHEO_TEST_MODE%") = "1")

' Keep the server window available for shutdown without covering the game.
If waitForExit Then
  exitCode = shell.Run(command, 7, True)
  WScript.Quit exitCode
Else
  shell.Run command, 7, False
End If
