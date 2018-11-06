
enum {rmMonitor, rmLog, rmTrack} repmode;

void led(bool on)
{
	digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
}

void wait(int mins, int blink=0)
{
	int seconds = (mins*60);
	
	if (blink)
	{
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
	else
	{
		for (int i=0; i < seconds; i++)
			delay(1000);
	}
}

bool cmd(char* pCmd, char* pFind=0)
{
	while (Serial.available())
		Serial.read();

	Serial.setTimeout(3000);
	Serial.write(pCmd);
	Serial.write("\r\n");
	
	if (pFind)
		return Serial.find(pFind);
	else
		return Serial.find("OK");
}

String read(char term)
{
	String str = Serial.readStringUntil(term);
	str.trim();
	return str;
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
	String h = read(':');
	String m = read(':');
	return {atoi(h.c_str()), atoi(m.c_str())};
}

void wakeGSM()
{
	cmd("AT+CFUN=1");
	wait(1, 1);
}

void sleep()
{
	cmd("AT+CGPSPWR=0");  // gps
	cmd("AT+SAPBR=0,1");  // gprs
	cmd("AT+CFUN=4");  // gsm
}

void setReportModeFromSMS()
{
	cmd("AT+CMGF=1");
	cmd("AT+CSCS=\"GSM\"");

	cmd("AT+CMGL=\"ALL\"", "CMGL:");
	while (Serial.find("REPMODE:"))
	{
		switch (Serial.parseInt())
		{
			case 0: repmode = rmMonitor; break;
			case 1: repmode = rmLog; break;
			case 2: repmode = rmTrack; break;
			default: break;
		}
	}

	cmd("AT+CMGDA=\"DEL ALL\"");
}

void report()
{
	led(true);

	// gprs
	cmd("AT+SAPBR=3,1,contype,GPRS");
	cmd("AT+SAPBR=3,1,APN,giffgaff.com");
	cmd("AT+SAPBR=3,1,USER,giffgaff");
	cmd("AT+SAPBR=1,1");
	cmd("AT+SAPBR=2,1");

	// gps
	cmd("AT+CGPSPWR=1");
	for (int c=0; c < 60; c++)
	{
		if (cmd("AT+CGPSSTATUS?", "3D Fix"))
			break;

		wait(1);
	}

	cmd("AT+CGPSSTATUS?", "+CGPSSTATUS:");
	String fix = read('\r');

	cmd("AT+CGPSINF=2", "+CGPSINF:");
	String loc = read('\r');

	//cmd("AT+CGPSINF=128", "+CGPSINF:");
	//String time = read('\r');

	cmd("AT+CSQ", "+CSQ:");
	String signal = read(',');

	String body;
	body += "GPS: ";
	body += fix;
	body += "\n\n";
	body += "https://ctcode.github.io/apps/ostracker/ostrkino.htm#";
	body += loc;
	body += "\n\n";
	body += "GSM: ";
	body += signal;
	body += "/30\n\n";
	body += "Report Mode: ";
	body += repmode;
	body += "\n\n";

	// email
	cmd("AT+EMAILCID=1");
	cmd("AT+EMAILSSL=1");
	cmd("AT+SMTPSRV=smtp.gmail.com,465");
	cmd("AT+SMTPAUTH=1,******@gmail.com,******");
	cmd("AT+SMTPFROM=******@gmail.com,trkino-mailer");
	cmd("AT+SMTPRCPT=0,0,******@gmail.com,ct");
	cmd("AT+SMTPSUB=Report");
	String cmdtxt = "AT+SMTPBODY=";
	cmdtxt += body.length();
	cmd(cmdtxt.c_str(), "DOWNLOAD");
	Serial.write(body.c_str());
	Serial.find("OK");
	cmd("AT+SMTPSEND");
	Serial.setTimeout(60000);
	Serial.find("+SMTPSEND:");

	led(false);
}

void setup()
{
	pinMode(LED_BUILTIN, OUTPUT);
	led(false);

	Serial.begin(9600);
	while(!Serial);

	while (true)
	{
		if (cmd("AT"))
			break;

		wait(1);
	}

	repmode = rmMonitor;

	wakeGSM();
	setReportModeFromSMS();
	report();
}

void loop()
{
	sleep();
	wait((60 - getTime().minute), 10);

	wakeGSM();
	setReportModeFromSMS();

	switch (repmode)
	{
		case rmMonitor:
		{
			switch (getTime().hour)
			{
				case 8:
				case 18:
					report();
			}
			
			break;
		}
		case rmLog:
		{
			switch (getTime().hour)
			{
				case 0:
					report();
			}
			
			break;
		}
		case rmTrack:
		{
			report();
			break;
		}
	}
}
