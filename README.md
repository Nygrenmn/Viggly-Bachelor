# Viggly
> **Bachelor thesis:** Viggly - Continuous Course Evaluations

A web application for lecture evaluation. Students can provide anonymous feedback on lectures, while lecturers can view results in a dashboard and manage semesters, courses, and lectures. Developed as a bachelor thesis, the project consists of a React/Vite frontend and an Express backend that connects to SQL Server.

## Tech
React (Vite) · Node.js (Express) · SQL Server (mssql) · Recharts · Canvas LTI 1.3 · Docker Compose

## Features
- **Anonymous student feedback forms** with scale questions and open-text comments
- **Protection mechanism** to prevent multiple submissions from the same student per lecture
- **Lecture filtering** based on course codes and semesters
- **Comprehensive results dashboard** for instructors with visual charts for distribution and averages
- **Dedicated administrator panel** for managing semesters, courses, and lectures
- **Integration with Canvas** via LTI 1.3 support
- **Local developer authentication routes** for testing without Canvas environment
- **Docker integration** for local SQL Server database setup

## Screenshots

<details>
  <summary>Student Survey Page</summary>
  <br>
  <p align="center">
    <img src="https://github.com/user-attachments/assets/af778404-2733-4c97-9440-7e9bff39b26d" width="400" alt="Student Survey Interface">
  </p>
</details>

<details>
  <summary>Lecture Selection Dropdown</summary>
  <br>
  <p align="center">
    <img src="https://github.com/user-attachments/assets/a260d4fe-0cf2-48cf-9242-09a390767bf6" width="600" alt="Login Interface">
  </p>
</details>

<details>
  <summary>Instructor Dashboard</summary>
  <br>
  <p align="center">
    <img src="https://github.com/user-attachments/assets/1b7bee8f-ea92-450f-921a-6edae4582bc2" width="700" alt="Instructor Dashboard">
  </p>
</details>

<details>
  <summary>Administrator Panel</summary>
  <br>
  <p align="center">
    <img src="https://github.com/user-attachments/assets/9a0f4198-8f3e-4065-8f6d-eb1dc1234f58" width="700" alt="Admin Panel">
  </p>
</details>

## My Contributions
I co-developed the frontend components and their corresponding stylesheets, including `AdminPanel.jsx`, `Modal.jsx`, `Results.jsx`, and `Survey.jsx`, along with `AdminPanel.css`, `Modal.css`, `Results.css`, and `Survey.css` with another teammember. Additionally, I was solely responsible for designing and implementing the data visualizations in `ResultsCharts.jsx`.

## Team
Group project — contributors include Atle, Marius, MartinN, and MartinU.
