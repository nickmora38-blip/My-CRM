# Deployment Instructions for My-CRM

This document outlines the steps necessary to deploy the My-CRM application to Heroku.

## Prerequisites
- Ensure you have a Heroku account. If not, sign up at [Heroku](https://www.heroku.com/).
- Install the Heroku CLI on your machine. Follow the instructions [here](https://devcenter.heroku.com/articles/heroku-cli) for installation.

## Steps to Deploy

1. **Login to Heroku**  
   Open your terminal and run the command:
   ```bash
   heroku login
   ```  
   Follow the prompts to enter your credentials.

2. **Clone the Repository**  
   If you haven't already, clone the My-CRM repository to your local machine:
   ```bash
   git clone https://github.com/nickmora38-blip/My-CRM.git
   cd My-CRM
   ```

3. **Create a New Heroku App**  
   Create a new app on Heroku:
   ```bash
   heroku create your-app-name
   ```  
   Replace `your-app-name` with a unique name for your application.

4. **Set Up Environment Variables**  
   If your application requires any environment variables, set them using the following command:
   ```bash
   heroku config:set VARIABLE_NAME=value
   ```  
   Repeat this for all necessary environment variables.

5. **Deploy to Heroku**  
   Push your code to Heroku:
   ```bash
   git push heroku main
   ```

6. **Open the Application**  
   Once the deployment is complete, you can access your application using:
   ```bash
   heroku open
   ```

7. **View Logs (Optional)**  
   If you want to monitor the application logs, run:
   ```bash
   heroku logs --tail
   ```

## Conclusion
Your My-CRM application should now be up and running on Heroku! 

For troubleshooting and further information, refer to the [Heroku Dev Center](https://devcenter.heroku.com/).