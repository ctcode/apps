
int repmode;
int wakestate;

enum {
	WS_GSM=0x0001,
	WS_GPRS=0x0002,
	WS_PWR_GPS=0x0004,
	WS_FIX_GPS=0x0008
};

bool checkstate(int ws)
{
	return (wakestate & ws) > 0;
}

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

bool cmd(char* pCmd, int wait_ms=500)
{
	while(Serial.available())
		Serial.read();

	Serial.write(pCmd);
	Serial.write("\r\n");
	Serial.flush();
	delay(wait_ms);
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
	// AT+CLTS=1 local time from network
	// AT&W save setting
	// +CCLK: "18/10/18,00:34:37+04"
	cmd("AT+CCLK?");
	Serial.find("CCLK:");
	Serial.find(",");
	String h = read(':');
	String m = read(':');
	return {atoi(h.c_str()), atoi(m.c_str())};
}

void wakeGSM()
{
	for (int c=0; c < 10; c++)
	{
		cmd("AT+CFUN=1", 3000);
		cmd("AT+CFUN?");
		if (Serial.find("CFUN: 1"))
		{
			wakestate |= WS_GSM;
			break;
		}
	}
}

void wakeGPRS()
{
	if (!checkstate(WS_GSM))
		return;

	cmd("AT+SAPBR=3,1,contype,GPRS");
	cmd("AT+SAPBR=3,1,APN,giffgaff.com");
	cmd("AT+SAPBR=3,1,USER,giffgaff");

	for (int c=0; c < 10; c++)
	{
		cmd("AT+SAPBR=1,1", 3000);
		cmd("AT+SAPBR=2,1");
		if (Serial.find("SAPBR: 1,1"))
		{
			wakestate |= WS_GPRS;
			break;
		}
	}
}

void wakeGPS()
{
	for (int c=0; c < 10; c++)
	{
		cmd("AT+CGPSPWR=1", 3000);
		cmd("AT+CGPSPWR?");
		if (Serial.find("CGPSPWR: 1"))
		{
			wakestate |= WS_PWR_GPS;
			break;
		}
	}

	if (!checkstate(WS_PWR_GPS))
		return;

	for (int c=0; c < 30; c++)
	{
		wait(1, 1);

		cmd("AT+CGPSSTATUS?");
		if (Serial.find("3D Fix"))
		{
			wakestate |= WS_FIX_GPS;
			break;
		}
	}
}

void sleep()
{
	int min = getTime().minute;

	cmd("AT+CGPSPWR=0");  // gps
	cmd("AT+SAPBR=0,1");  // gprs
	cmd("AT+CFUN=4");  // gsm
	wakestate=0;

	wait((60 - min), 10);
}

void setReportModeFromSMS()
{
	wait(1, 5);

	cmd("AT+CMGF=1");
	cmd("AT+CSCS=\"GSM\"");
	cmd("AT+CMGL=\"ALL\"", 10);

	while (Serial.find("REPMODE:"))
	{
		int rm = Serial.parseInt();
		switch (rm)
		{
			case 0:
			case 1:
			case 2:
			case 24:
				repmode = rm;
			default:
				break;
		}
	}

	cmd("AT+CMGDA=\"DEL ALL\"");
}

void report()
{
	wakeGPS();
	wakeGPRS();

	if (!checkstate(WS_GPRS))
		return;

	led(true);

	cmd("AT+CGPSSTATUS?");
	Serial.find("CGPSSTATUS:");
	String fix = read('\r');

	cmd("AT+CSQ");
	Serial.find("CSQ:");
	String signal = read(',');

	cmd("AT+CGPSINF=2");
	Serial.find("CGPSINF:");
	String loc = read('\r');

	String body;
	body += "GPS: ";
	body += fix;
	body += "\n\n";
	body += "GSM: ";
	body += signal;
	body += "/30\n\n";
	body += "REPMODE:";
	body += repmode;
	body += "\n\n";

	if (checkstate(WS_FIX_GPS))
	{
		body += "https://ctcode.github.io/apps/ostracker/ostrkino.htm#";
		body += loc;
		body += "\n\n";
	}

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
	cmd(cmdtxt.c_str());
	Serial.find("DOWNLOAD");
	Serial.write(body.c_str());
	Serial.flush();
	Serial.find("OK");
	cmd("AT+SMTPSEND");
	Serial.setTimeout(60000);
	Serial.find("SMTPSEND:");
	Serial.setTimeout(3000);

	led(false);
}

void setup()
{
	pinMode(LED_BUILTIN, OUTPUT);
	led(false);

	Serial.setTimeout(3000);
	Serial.begin(9600);
	while(!Serial);

	while (true)
	{
		cmd("AT");

		if (Serial.find("OK"))
			break;

		wait(1);
	}

	repmode=2;
	wakestate=0;

	wakeGSM();
	setReportModeFromSMS();
	report();
}

void loop()
{
	sleep();
	wakeGSM();
	setReportModeFromSMS();

	switch (repmode)
	{
		case 1:
		{
			switch (getTime().hour)
			{
				case 0:
					report();
			}
			
			break;
		}
		case 2:
		{
			switch (getTime().hour)
			{
				case 8:
				case 18:
					report();
			}
			
			break;
		}
		case 24:
		{
			report();
			break;
		}
		default:
			break;
	}
}
