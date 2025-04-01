Halo Backend is a Node.js application that powers the backend for a healthcare consultancy chatbot. It provides APIs for user authentication, chat functionality, and consultation requests, integrating with MongoDB for data storage and Socket.IO for real-time communication. The application is designed to work with a Next.js frontend and can be deployed on AWS Elastic Beanstalk for production use.

Features
User Authentication: Register, login, and manage user sessions using JWT.
Chat Functionality: Real-time chat with an AI assistant using Socket.IO and OpenAI's API.
Consultation Requests: Submit consultation requests, accessible only to authenticated users.
MongoDB Integration: Store user data, chat threads, and messages in MongoDB.
Category Dropdowns: Predefined prompts for FAQs, policies, planning, resources, courses, and consultation requests.
AWS Deployment Ready: Configured for deployment on AWS Elastic Beanstalk with MongoDB Atlas.
Tech Stack
Node.js: Backend runtime environment.
Express.js: Web framework for building RESTful APIs.
MongoDB: NoSQL database for storing user and chat data.
Mongoose: ODM for MongoDB.
Socket.IO: Real-time communication for chat functionality.
JWT: JSON Web Tokens for user authentication.
Bcryptjs: Password hashing for secure user authentication.
dotenv: Environment variable management.
AWS Elastic Beanstalk: Deployment platform (optional).
Prerequisites
Before setting up the project, ensure you have the following installed:

Node.js: Version 14.x or higher (recommended: 18.x).
npm: Comes with Node.js (recommended: 8.x or higher).
MongoDB: Either a local MongoDB instance or a MongoDB Atlas account.
Git: For cloning the repository.

-- Installation -- 
## Clone Repository
$ git clone https://github.com/your-username/halo-backend.git

## Go into the repository
$ cd halo-backend

## Install Dependencies
$ npm install

## Create a .env file in the root directory

## Run the Application
$ npm start

## Check if server is running
$ Server running on port 3001

