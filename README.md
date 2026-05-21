# Viggly - Continuous Course Evaluations
A web application for lecture evaluation. Students can provide anonymous feedback on lectures, while lecturers can view results in a dashboard and manage semesters, courses, and lectures. Developed as a bachelor thesis, the project consists of a React/Vite frontend and an Express backend that connects to SQL Server.

## Tech
React · Vite · Express · SQL Server (`mssql`) · Recharts · Canvas LTI 1.3 · Docker Compose

## Features
- Anonymous student feedback forms with scale questions and open-text comments
- Protection mechanism to prevent multiple submissions from the same student per lecture
- Lecture filtering based on course codes and semesters
- Comprehensive results dashboard for instructors with visual charts for distribution and averages
- Dedicated administrator panel for managing semesters, courses, and lectures
- Seamless integration with Canvas via LTI 1.3 support
- Local developer authentication routes for testing without Canvas environment
- Docker integration for local SQL Server database setup

## My Contributions
I co-developed the frontend components and their corresponding stylesheets, including AdminPanel.jsx, Modal.jsx, Results.jsx, and Survey.jsx, along with AdminPanel.css, Modal.css, Results.css, and Survey.css with another teammember. Additionally, I was solely responsible for designing and implementing the data visualizations in ResultsCharts.jsx.

## Team
Group project — contributors include Atle, Marius, MartinN, and MartinU.