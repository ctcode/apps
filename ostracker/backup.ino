
void led(bool on)
{
	digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
}

void wait(int mins, int blink)
{
	int seconds = (mins*60);
	int c=0;
	led(false);

	for (int i=0; i < seconds; i++)
	{
		c++;
		if (c > blink)
		{
			led(true);
			delay(100);
			led(false);
			delay(900);
			
			c = 0;
		}
		else
			delay(1000);
	}
}

bool cmd(char* pCmd, char* pFind=0)
{
	while(Serial.available())
		Serial.read();

	Serial.setTimeout(3000);
	Serial.write(pCmd);
	Serial.write("\r\n");
	delay(1000);
	
	if (pFind)
		return Serial.find(pFind);
	else
		return Serial.find("OK");
}

struct hhmm
{
	int hour;
	int minute;
};

struct hhmm getTime()
{
	// +CCLK: "18/10/18,00:34:37+04"
	cmd("AT+CCLK?", "+CCLK:");
	Serial.find(",");
	String h = Serial.readStringUntil(':');
	String m = Serial.readStringUntil(':');
	return {atoi(h.c_str()), atoi(m.c_str())};
}

int wake()
{
	cmd("AT+CGPSPWR=1");
	cmd("AT+CFUN=1");
}

int sleep()
{
	cmd("AT+CGPSPWR=0");
	cmd("AT+CFUN=4");
}

void report()
{
	led(true);

	String body;

	// gps
	if (cmd("AT+CGPSSTATUS?", "Location 3D Fix"))
	{
		cmd("AT+CGPSINF=2", "+CGPSINF:");
		String loc = Serial.readStringUntil('\r');
		loc.trim();

		cmd("AT+CGPSINF=128", "+CGPSINF:");
		String time = Serial.readStringUntil('\r');
		time.trim();

		body += "GPS Fix\n\n";
		body += "https://ctcode.github.io/apps/ostracker/ostrkmap.htm";
		body += "#trkino,";
		body += "LOCATION,";
		body += loc;
		body += ",";
		body += "TIME,";
		body += time;
		body += "\n\n";
	}
	else
	{
		cmd("AT+CGPSSTATUS?", "+CGPSSTATUS:");
		String status = Serial.readStringUntil('\r');
		status.trim();

		body += status;
		body += "\n\n";
	}

	// gprs
	cmd("AT+SAPBR=3,1,contype,GPRS");
	cmd("AT+SAPBR=3,1,APN,giffgaff.com");
	cmd("AT+SAPBR=3,1,USER,giffgaff");
	cmd("AT+SAPBR=1,1");
	cmd("AT+SAPBR=2,1");

	// email
	cmd("AT+EMAILCID=1");
	cmd("AT+EMAILSSL=1");
	cmd("AT+SMTPSRV=smtp.gmail.com,465");
	cmd("AT+SMTPAUTH=1,******@gmail.com,,******");
	cmd("AT+SMTPFROM=,******@gmail.com,trkino-mailer");
	cmd("AT+SMTPRCPT=0,0,,******@gmail.com,ct");
	cmd("AT+SMTPSUB=Location report");
	String cmdtxt = "AT+SMTPBODY=";
	cmdtxt += body.length();
	cmd(cmdtxt.c_str(), "DOWNLOAD");
	Serial.write(body.c_str());
	Serial.find("OK");
	cmd("AT+SMTPSEND");
	Serial.setTimeout(60000);
	Serial.find("+SMTPSEND:");
	cmd("AT+SAPBR=0,1");

	led(false);
}

void setup()
{
	pinMode(LED_BUILTIN, OUTPUT);
	led(false);
	
	Serial.begin(9600);
	while(!Serial);

	wake();
	wait(1, 2);
}

void loop()
{
	switch (getTime().hour)
	{
		case 8:
		case 18:
		{
			wake();
			wait(15, 1);
			report();
			sleep();
			break;
		}
		default:
			sleep();
	}

	wait((60 - getTime().minute), 10);
}
