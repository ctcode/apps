print("Stripping...\n")

gpxfile = open("D:\\localdocs\\files\\src.gpx", "r")
stripfile = open("D:\\localdocs\\files\\strip.gpx", "w")
c=0

for line in gpxfile:
	c = c+1
	line = line.strip()
	if "<ele" in line:
		continue
	if "<time" in line:
		continue
	if "<name" in line:
		stripfile.write("\t" + line + "\n")
		continue
	if "<trkseg" in line:
		stripfile.write("\t" + line + "\n" + "\t\t")
		continue
	if "<trkpt" in line:
		stripfile.write(line)
		continue
	if "</trkpt" in line:
		stripfile.write(line)
		continue
	if "</trkseg" in line:
		stripfile.write("\n\t" + line + "\n")
		continue
	stripfile.write(line + "\n")

print("Lines: " + str(c) + "\n")
input("OK")
