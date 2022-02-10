const gpio = require('rpi-gpio');
gpio.setMode(gpio.MODE_BCM);

let Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('Motion Plus Sensor', MotionSensor);
};

class MotionSensor {
    constructor(log, config) {
        this.log = log;
        this.name = config.name;
        this.pirPin = config.pirPin;
        this.motionDetected = false;
        this.timeoutSeconds = config.timeoutSeconds ?? 10 // default is 10 seconds
        this.delayMilliseconds = config.delayMilliseconds ?? 0
    }

    identify(callback) {
        this.log('Identify requested!');
        callback(null);
    }

    getServices() {
        const informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Encore Dev Labs')
            .setCharacteristic(Characteristic.Model, 'Pi Motion Sensor')
            .setCharacteristic(Characteristic.SerialNumber, 'Raspberry Pi');

        this.service = new Service.MotionSensor(this.name);
        this.service
            .getCharacteristic(Characteristic.MotionDetected)
            .on('get', (callback) => {
                callback(null, this.motionDetected);
            });


        let delayTimer
        let timeoutTimer

        gpio.on('change', (channel, value) => {
            if (channel === this.pirPin) {
                this.log.info("PIR Motion detected: " + value)
                this.motionDetected = value

                if (value) {
                    // we can wait a defined amount of seconds before setting the motion
                    delayTimer = setTimeout(() => {
                        this.log.info("After Delay: " + this.motionDetected)
                        this.service.setCharacteristic(Characteristic.MotionDetected, this.motionDetected);
                        // after motion was notified we wait and check if in that time another motion was detected
                        if (this.motionDetected) {
                            timeoutTimer = setTimeout(() => {
                                this.log.info("After timeout: " + this.motionDetected)
                                this.service.setCharacteristic(Characteristic.MotionDetected, this.motionDetected);
                            }, this.timeoutSeconds * 1000)
                        } else {
                            this.service.setCharacteristic(Characteristic.MotionDetected, false);
                        }
                    }, this.delayMilliseconds)
                } else {
                    clearTimeout(delayTimer)
                    clearTimeout(timeoutTimer)
                    this.service.setCharacteristic(Characteristic.MotionDetected, false);
                }
            }
        });

        gpio.setup(this.pirPin, gpio.DIR_IN, gpio.EDGE_BOTH, () => {
            gpio.read(this.pirPin, (err, value) => {
                if (err) {
                    console.error(err); // eslint-disable-line no-console
                    return;
                }

                this.motionDetected = value;
            });
        });

        this.service
            .getCharacteristic(Characteristic.Name)
            .on('get', callback => {
                callback(null, this.name);
            });

        return [informationService, this.service];
    }
}
