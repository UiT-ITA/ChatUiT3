import { useEffect, useState } from 'react';
import './App.css';
import { useAuth } from './contexts/AuthContext';
import WelcomePage from './pages/WelcomePage';

interface Forecast {
    date: string;
    temperatureC: number;
    temperatureF: number;
    summary: string;
}

function App() {
    const [forecasts, setForecasts] = useState<Forecast[]>();
    const { isAuthenticated, isInitializing, logout, getAccessToken } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            populateWeatherData();
        }
    }, [isAuthenticated]);

    const contents = forecasts === undefined
        ? <p><em>Loading... Please refresh once the ASP.NET backend has started. See <a href="https://aka.ms/jspsintegrationreact">https://aka.ms/jspsintegrationreact</a> for more details.</em></p>
        : <table className="table table-striped" aria-labelledby="tableLabel">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Temp. (C)</th>
                    <th>Temp. (F)</th>
                    <th>Summary</th>
                </tr>
            </thead>
            <tbody>
                {forecasts.map(forecast =>
                    <tr key={forecast.date}>
                        <td>{forecast.date}</td>
                        <td>{forecast.temperatureC}</td>
                        <td>{forecast.temperatureF}</td>
                        <td>{forecast.summary}</td>
                    </tr>
                )}
            </tbody>
        </table>;

    if (isInitializing) {
        return <div className="loading-container">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <WelcomePage />;
    }

    return (
        <div className="app-container">
            <header className="app-header">
                <h1 id="tableLabel">Weather forecast</h1>
                <button className="logout-button" onClick={logout}>Logout</button>
            </header>
            <p>This component demonstrates fetching data from the server.</p>
            {contents}
        </div>
    );

    async function populateWeatherData() {
        try {
            const token = await getAccessToken();

            if (!token) {
                console.error('No access token available. Please log in again.');
                return;
            }
            
            // Ensure we use the correct API path with leading slash
            // This helps avoid issues with relative path resolution
            const response = await fetch('/api/weatherforecast', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json() as Forecast[];
                setForecasts(data);
            } else {
                console.error("API request failed:", response.status, response.statusText);
                const errorText = await response.text();
                console.error("Error details:", errorText.substring(0, 200));
            }
        } catch (error) {
            console.error('Error fetching weather data:', error);
        }
    }
}

export default App;