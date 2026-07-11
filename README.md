# LC Gate Monitoring

A real-time, distributed edge-computing dashboard for monitoring live physical gates and traffic nodes. Built with a decoupled data ingestion architecture and zero-trust hardware synchronization.

## 🏗️ Architecture Overview

This system is designed for **infinite scalability** and **fault tolerance** using a Hybrid Edge-Computing model:

*   **Real-Time Event Streaming:** Uses WebSockets (STOMP/SockJS) to push live state changes to the UI without HTTP polling, ensuring millisecond-level responsiveness.
*   **Edge Computing Engine:** Heavy mathematical calculations (cycle durations, modulo sequences, elapsed times) are offloaded to the client's browser. This results in near-zero backend CPU load, allowing the system to scale to thousands of concurrent viewers effortlessly.
*   **Hybrid Time-Sync (Zero-Trust):** Solves the standard Edge Computing flaw (local clock drift) by anchoring the frontend JavaScript engine to the backend server's atomic clock timestamp. Hardware anomalies (like drifting IoT device clocks sending "future" timestamps) are gracefully caught and mitigated by the software.
*   **Decoupled Data Ingestion:** Utilizes a Google Sheet CSV export as a highly accessible data layer, allowing non-technical operators to update configurations without developer intervention or redeployment.

## 💻 Tech Stack

*   **Backend:** Java, Spring Boot
*   **Real-Time Messaging:** WebSockets, STOMP
*   **Frontend:** HTML5, JavaScript (ES6), Bootstrap 5
*   **Data Layer:** REST API, Google Sheets API Integration

## 🚀 How to Run Locally

1. Clone this repository.
2. Ensure you have Java 17+ and Maven installed.
3. Open the `src/main/resources/application.properties` file.
4. Locate the following line:
   `railway.sheet.url=sheet_url`
5. Replace `sheet_url` with the CSV export link of your own Google Sheet. (Make sure your Google Sheet access is set to "Anyone with the link").
6. Run the application:
   ```bash
   mvn spring-boot:run
   ```
7. Open your browser and navigate to: `http://localhost:8080`

## 🧠 System Resiliency & Error Handling
The backend features robust data validation. If corrupted coordinates or broken duration variables are ingested from the data layer, the backend shields the application from crashing and securely skips the corrupted row while maintaining live WebSocket connections.