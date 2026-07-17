# LC Gate Monitoring System

## 🚀 Overview
The LC (Level Crossing) Gate Monitoring System is a highly scalable, real-time tracking dashboard designed to monitor railway crossings and traffic infrastructure. Engineered with a **"Frontend-First" edge computing model** and a **loosely coupled architecture**, this platform delivers microsecond data updates while keeping server load incredibly low. 

It transitions standard data ingestion (currently utilizing Google Sheets as a high-speed, lightweight data layer) into a distributed, multiplexed data pipeline capable of handling thousands of gates simultaneously.

## ✨ Key Features
* **Real-Time Data Pipeline:** Utilizes a single, multiplexed STOMP WebSocket connection to push real-time status updates to the client without polling, ensuring instant UI updates and minimal bandwidth consumption.
* **Edge-Computed Live Timers:** Server CPU load is minimized by offloading live timer calculations to the client's browser. The server simply broadcasts the target timestamp, and the frontend independently calculates the time elapsed for all active gates.
* **Intelligent Historical Analytics:** The backend automatically detects when a gate event completes (via chronological overwriting), calculates the final duration, and serves pre-calculated historical data to ensure instant initial page loads.
* **In-Memory Caching:** Utilizes Java `ConcurrentHashMap` and object referencing to maintain a highly efficient, thread-safe cache in the server's heap memory for instant data retrieval.

## 🛠️ Technologies Used
* **Backend:** Java 17+, Spring Boot
* **Real-Time Communication:** WebSockets, STOMP Protocol
* **Data Ingestion:** Asynchronous URL stream processing (Google Sheets CSV integration)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript
* **Deployment Setup:** Optimized for cloud hosting (e.g., Render) with dynamic environment variables.

## 🧩 Architecture & Loose Coupling
This system was explicitly designed with a **decoupled, modular architecture** that separates the data ingestion layer from the presentation layer. 

* **Database Agnostic:** Currently, the system uses a 24-hour rotating spreadsheet model for live ingestion. Because the core logic is abstracted behind the `GateDataService`, transitioning to a relational database (like PostgreSQL) requires **zero changes to the frontend or WebSocket routing**.
* **Seamless Analytics Migration:** Insights, historical durations, and gate logs are currently stored in memory per gate. In the future, these can be seamlessly swapped to be calculated and queried directly from a SQL database or cold storage. The frontend will continue to receive the exact same JSON payload, proving the strict separation of concerns.

## 📈 Future Scalability
The platform is built as a foundational SaaS (Software as a Service) product, ready to scale horizontally:
1. **Horizontal Sharding:** The architecture supports dividing large regions (e.g., thousands of gates) across multiple data shards. The backend asynchronously processes multiple zone files, routing them to specific WebSocket topics (e.g., `/topic/lucknow`).
2. **Enterprise Caching:** The current `ConcurrentHashMap` logic is perfectly mapped to transition into an external in-memory data store like **Redis**, enabling the system to scale across multiple server instances.
3. **B2B REST API Ready:** The backend is structured to easily expose a RESTful API with rate-limiting, allowing third-party logistics and navigation companies (e.g., Uber, Zomato, Google Maps) to query live gate statuses for automated route optimization.