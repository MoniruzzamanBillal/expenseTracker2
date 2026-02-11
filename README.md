# # ExpenseTracker- React Native Expense Tracker App

**ExpenseTracker** is a full-stack Android application that helps users track their daily income and expenses efficiently. Built using React Native and Node.js, this app offers a clean UI, real-time calculations, and intuitive features for financial tracking on the go.

---

## 🎯 Project Objectives

- Enable users to track income, expenses, and balance on a **daily, monthly, and yearly** basis.
- Provide a clean and simple interface for adding and reviewing financial transactions.
- Ensure secure user authentication and personalized data management.
- Deliver a full-stack mobile-first experience with persistent backend storage.

---

## 🚀 Core Features

### 🏠 Home Page

- Displays **today's total income, expenses, and balance**.
- Shows a list of today's transactions.

---

### 📅 Monthly Transactions

- Provides a **monthly summary** of income, expenses, and balance.
- Scrollable list showing each day’s transaction history within the current month.

---

### 🧾 Yearly History

- Displays **total income, expenses, and balance per month** for the current year.

---

### ➕ Add Transaction

- Easily add a transaction by selecting type (income/expense), entering the amount, title, and details.
- Newly added transactions are reflected immediately.

---

## 🤖 AI-Powered Smart Transaction Parsing

To improve user experience and reduce manual effort, **ExpenseTracker** includes an AI-assisted transaction feature powered by an OpenRouter free AI model.

Users can describe their transactions in natural language. For example:

> "Bought groceries for 850 taka and received 5000 taka salary today."

The system analyzes the input and automatically:

- Detects whether the transaction is **Income** or **Expense**
- Extracts the **amount**
- Generates an appropriate **title**
- Adds a meaningful **description**
- Structures the transaction data correctly

The AI response is processed and converted into the following structured format:

- `type` (income / expense)
- `title`
- `amount`
- `description`

This allows users to add transactions faster while demonstrating practical AI integration within a real-world mobile application.

---

### 🔧 AI Integration Details

- **AI Provider**: OpenRouter (Free Model)
- **Architecture**: Prompt-based structured response generation
- **Backend Processing**: Node.js & Express.js
- **API Communication**: Secure request handling between mobile client and backend server

This feature highlights hands-on experience integrating third-party AI APIs into a full-stack React Native application.

---

## 🔐 Authentication

- Secure **JWT-based authentication** for login and registration.
- Each user can only view and manage their own financial data.

---

## 🧰 Tech Stack

- **Frontend**: React Native (Expo), React Navigation, Axios
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JSON Web Tokens (JWT)
- **State Management**: React Context API + useReducer

---

## 📸 Screenshots

<p align="center">
  <img src="https://i.postimg.cc/qBQ2Wcy9/1-login.jpg" alt="Login Page" />
</p>

<p align="center">
  <img src="https://i.postimg.cc/y6fSL1zK/2-register.jpg" alt="Register" />
</p>

<p align="center">
  <img src="https://i.postimg.cc/D0m09GKT/3-home.jpg" alt="Home Page" />
</p>

<p align="center">
  <img src="https://i.postimg.cc/85PwxNKg/Whats-App-Image-2026-02-11-at-11-47-04-AM-(1).jpg" alt="Monthly Transactions1" />
</p>

<p align="center">
  <img src="https://i.postimg.cc/SRYLpsW0/Whats-App-Image-2026-02-11-at-11-49-07-AM.jpg" alt="Monthly Transactions2" />
</p>

<p align="center">
  <img src="https://i.postimg.cc/zGpBGpXr/6-transaction-page.jpg" alt="Add Transaction" />
</p>

<p align="center">
  <img src="https://i.postimg.cc/13KgNsBb/5-history.jpg" alt="History Page" />
</p>

---

## 📱 Demo Video

A complete walkthrough of all app features.

video link : https://drive.google.com/file/d/1ldSujwrj7bQlwAGk1OzOKDohC0jwamVI/view?usp=sharing

---

## 📱 APK Download

You can try out the app by installing the APK directly on your Android device:
link : https://drive.google.com/file/d/1r-0RZemoPWDM5RaSGHQYCgqa18d1pGQd/view?usp=sharing

---
