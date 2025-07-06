FastPass Truv – Employment Verification
Live Demo with PayPal Paywall

This is a ready-to-deploy demo of employment verification using Truv APIs.
A working paywall powered by PayPal is included—users must pay to unlock verified employment data!

🚀 Live Heroku Demo
Try it now:
https://fastpasstruv-db0709d97556.herokuapp.com/

Get Started (Local Setup)
Clone the repository

sh
Copy
Edit
git clone https://github.com/Lpierzina/FastPassTruvVoE.git
Open the Node.js quickstart directory and create a .env file:
cd

sh
Copy
Edit
cd quickstart/node
cp .env.example .env
# or manually create .env with your credentials
Add your Truv Client ID and Sandbox Access Key:

ini
Copy
Edit
# required
API_CLIENT_ID=<your-client-id>
API_SECRET=<your-sandbox-secret>
API_PRODUCT_TYPE=employment

# optional: use Orders API instead of Users API
IS_ORDER=false
Install dependencies & start the Node.js server:

sh
Copy
Edit
npm install
npm start
View the demo:

Open http://localhost:5000 in your browser.

Features
Truv Bridge Integration: Employment verification using Truv’s APIs.

PayPal Paywall: Users must pay via PayPal before seeing verified employment data.

Modern UI: Clean and mobile-friendly, with an easy step-by-step flow.

Ready for Heroku: Just push and it works—no manual static build steps required.

Running on Heroku
Set your environment variables in Heroku:

sh
Copy
Edit
heroku config:set API_CLIENT_ID=xxx API_SECRET=yyy API_PRODUCT_TYPE=employment IS_ORDER=false
Deploy:

sh
Copy
Edit
git push heroku master
Done! Open your Heroku app’s URL to try the live demo.

Resources
Truv Docs: https://docs.truv.com/docs/quickstart-guide

PayPal Developer: https://developer.paypal.com/

