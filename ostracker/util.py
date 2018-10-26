import socket
import sys
import webbrowser
import time
import ctypes

ctypes.windll.kernel32.SetConsoleTitleW("ostracker/util")

adr = ('192.168.0.33', 50320)
skt = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
skt.bind(adr)
skt.listen(3)
print("TrackNET 192.168.0.33 port 50320\n")

cmd = input("(m)onitor; (v)erify; (c)ommand; >>> ")

if cmd == "m":
	print(time.strftime("\n[%H:%M:%S] ..."))
	while True:
		connection, address = skt.accept()
		print("Received connection from", address)
		req = str(connection.recv(4096).decode())
		print(time.strftime("[%H:%M:%S] ")+req)
		connection.close()

elif cmd == "v":
	webbrowser.open('http://86.20.132.83:50320')
	while True:
		connection, address = skt.accept()
		req = str(connection.recv(4096).decode())
		tok = req.split(' ')
		if len(tok)>0 and tok[0]=="GET":
			body = "Connected to TrackNET"
			res = "HTTP/1.1 200 OK" + '\n'
			#res += "Access-Control-Allow-Origin: *" + '\n'
			res += "Content-Type: text/plain; charset=utf-8" + '\n'
			res += "Content-Length: " + str(len(body)) + '\n'
			res += '\n'
			res += body
			connection.sendall(res.encode())
			connection.close()
			break
		else:
			connection.close()

elif cmd == "c":
	trkcmd = input("Tracker command >>> ")
	while True:
		print(time.strftime("\n[%H:%M:%S] Waiting for Tracker connection..."))
		connection, address = skt.accept()
		print("Received connection from", address)
		req = str(connection.recv(4096).decode())
		
		if req == "##,imei:868683022447472,A;":
			res = "LOAD"
			connection.sendall(res.encode())
			print("Connected to Tracker")
			connection.sendall(trkcmd.encode())
			print("Sent: "+trkcmd+"...")
			break
		else:
			connection.close()
			print("Connection closed")

	while True:
		req = str(connection.recv(4096).decode())
		print(time.strftime("\n[%H:%M:%S] ")+req)
		if req == "868683022447472;":
			res = "ON"
			connection.sendall(res.encode())



#skt.close()
#print("Port closed")
#input()


#imei:868683022447472,tracker,171103024907,,F,014902.000,A,5301.6993,N,00236.2838,W,0.00,0;
#imei:868683022447472,tracker,140101000056,,L,,,53d4,,87a0,,,;
#N:53d1.6993m W:002d36.2838m = lat:53.028322,lon:-2.60473
#lat:53.028262,lon:-2.604837
#decimal degrees = (degrees + (minutes/60))
#eg. if N (DDMM.MMMM) = 5301.6993, lat = (53 + (1.6993/60))
#eg. if W (DDDMM.MMMM) = 00236.2838, lon = -(2 + (36.2838/60))
#res = "**,imei:868683022447472,N" # SMS mode
#res = "**,imei:868683022447472,C,15s" # repeat location every 15s
