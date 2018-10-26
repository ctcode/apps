import socket
import sys
import webbrowser
import time
import ctypes

ctypes.windll.kernel32.SetConsoleTitleW("ostracker/trknet")

adr = ('192.168.0.33', 50320)
skt = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
skt.bind(adr)
skt.listen(3)
print("TrackNET 192.168.0.33 port 50320\n")

while True:
	print(time.strftime("[%H:%M:%S] Waiting for Tracker connection..."))
	connection, address = skt.accept()
	print("Received connection from", address)
	req = str(connection.recv(4096).decode())
	
	if req == "##,imei:868683022447472,A;":
		res = "LOAD"
		print(res)
		connection.sendall(res.encode())
		print("Connected to Tracker")
		break
	else:
		connection.close()
		print("Connection closed")

print(time.strftime("\n[%H:%M:%S] Waiting for GPS location..."))
while True:
	req = str(connection.recv(4096).decode())
	print(time.strftime("[%H:%M:%S] ")+req)
	csv = req.split(',')
	if len(csv) > 10 and csv[0] == "imei:868683022447472" and csv[1] == "tracker" and csv[4] == "F":
		print(time.strftime("[%H:%M:%S] *** TRACKER LOCATION RECEIVED ***"))
		logfile = open("D:\\localdocs\\files\\trknet.log", "w")
		logfile.write(req)
		logfile.close()
		cmd = input("<ENTER> view map; >>> ")
		if cmd == "":
			webbrowser.open_new_tab('http://localhost/apps/ostracker/ostrkmap.htm#' + req)
		break
	if req == "868683022447472;":
		res = "ON"
		print(res)
		connection.sendall(res.encode())
		res = "**,imei:868683022447472,B" # single location
		print(res)
		connection.sendall(res.encode())

connection.close()
print("Connection closed\n")
