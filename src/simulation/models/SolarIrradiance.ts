// Solar irradiance calculation based on time, date, and location
// Includes cloud simulation for realistic intermittent sunlight

export class SolarIrradiance {
  private latitude: number
  private cloudTimer: number = 0
  private cloudIntensity: number = 1.0
  private cloudPhase: 'clear' | 'passing' | 'cloudy' = 'clear'

  constructor(latitude: number = 35.0) {
    this.latitude = latitude * (Math.PI / 180) // Convert to radians
  }

  /**
   * Calculate solar declination angle based on day of year
   */
  private getDeclination(dayOfYear: number): number {
    return 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * (Math.PI / 180))
  }

  /**
   * Calculate hour angle (degrees)
   */
  private getHourAngle(hour: number): number {
    return (hour - 12) * 15
  }

  /**
   * Calculate solar altitude angle (zenith)
   */
  private getZenithAngle(dayOfYear: number, hour: number): number {
    const declination = this.getDeclination(dayOfYear) * (Math.PI / 180)
    const hourAngle = this.getHourAngle(hour) * (Math.PI / 180)

    const zenith = Math.acos(
      Math.sin(this.latitude) * Math.sin(declination) +
        Math.cos(this.latitude) * Math.cos(declination) * Math.cos(hourAngle)
    )

    return zenith
  }

  /**
   * Calculate extraterrestrial irradiance (W/m²)
   */
  private getExtraterrestrialIrradiance(dayOfYear: number): number {
    // Solar constant approximately 1361 W/m²
    const solarConstant = 1361
    // Earth-Sun distance variation
    const eccentricity = 1 + 0.033 * Math.cos((360 / 365) * dayOfYear * (Math.PI / 180))
    return solarConstant * eccentricity
  }

  /**
   * Simulate cloud passing effect on irradiance
   * Uses a state machine to create realistic cloud patterns
   */
  private updateCloudSimulation(dtSeconds: number): void {
    this.cloudTimer -= dtSeconds

    if (this.cloudTimer <= 0) {
      // Transition to next state
      switch (this.cloudPhase) {
        case 'clear':
          // 30% chance of clouds coming
          if (Math.random() < 0.3) {
            this.cloudPhase = 'passing'
            this.cloudTimer = 3000 + Math.random() * 5000 // 3-8 seconds to pass
            this.cloudIntensity = 0.3 + Math.random() * 0.4 // 30-70% transmission
          } else {
            this.cloudTimer = 5000 + Math.random() * 10000 // Stay clear 5-15 seconds
          }
          break

        case 'passing':
          // Clouds fully overhead
          this.cloudPhase = 'cloudy'
          this.cloudTimer = 2000 + Math.random() * 3000 // Stay 2-5 seconds
          break

        case 'cloudy':
          // Clouds passing away
          this.cloudPhase = 'clear'
          this.cloudTimer = 3000 + Math.random() * 8000 // Next cloud in 3-11 seconds
          this.cloudIntensity = 1.0
          break
      }
    }

    // Smooth transition during passing phase
    if (this.cloudPhase === 'passing') {
      // Gradually decrease then increase transmission
      const progress = 1 - (this.cloudTimer / 8000)
      if (progress < 0.5) {
        this.cloudIntensity = 0.3 + progress * 0.6 // Drop from 0.3 to 0.6
      } else {
        this.cloudIntensity = 0.6 + (progress - 0.5) * 0.8 // Rise to 1.0
      }
    }
  }

  /**
   * Calculate clear-sky irradiance at ground level (W/m²)
   */
  calculate(hour: number, dayOfYear: number, dtSeconds: number = 1): number {
    // Update cloud simulation
    this.updateCloudSimulation(dtSeconds)

    const zenith = this.getZenithAngle(dayOfYear, hour)

    // Night time (zenith > 89°)
    if (zenith > 89 * (Math.PI / 180)) {
      return 0
    }

    // Air mass modifier (atmospheric attenuation)
    const airMass = 1 / Math.cos(zenith)
    const amModifier = Math.pow(0.7, airMass)

    // Extraterrestrial irradiance
    const extraterrestrial = this.getExtraterrestrialIrradiance(dayOfYear)

    // Apply cloud effect
    const clearSkyIrradiance = extraterrestrial * amModifier * Math.cos(zenith)
    return Math.max(0, clearSkyIrradiance * this.cloudIntensity)
  }

  /**
   * Get sunrise and sunset hours for a given day
   */
  getSunHours(dayOfYear: number): { sunrise: number; sunset: number } {
    const declination = this.getDeclination(dayOfYear) * (Math.PI / 180)

    // Hour angle at sunrise/sunset (when sun is at horizon)
    const ha = Math.acos(-Math.tan(this.latitude) * Math.tan(declination)) * (180 / Math.PI)

    const solarNoon = 12
    const sunrise = solarNoon - ha / 15
    const sunset = solarNoon + ha / 15

    return { sunrise: Math.max(0, sunrise), sunset: Math.min(24, sunset) }
  }
}
