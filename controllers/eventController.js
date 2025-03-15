const express = require('express');
const router = express.Router();
const Event = require('../models/event');


exports.createEvent = async (req, res) => {
    try {
        const { Subject, Location, StartTime, EndTime, Description, } = req.body.updatedData

        //     const startTime = new Date(StartTime).toLocaleString('en-US', {
        //         timeZone: 'Asia/Kolkata', // Use the desired time zone
        //       });

        //   const endTime = new Date(EndTime).toLocaleString('en-US', {
        //     timeZone: 'Asia/Kolkata', // Use the desired time zone
        //   });
        const newEvent = await Event.create({
            schoolId: req.user.schoolId,
            Subject: Subject,
            Location: Location,
            StartTime: StartTime,
            EndTime: EndTime,
            Description: Description
        });

        res.status(201).json({ success: true, data: newEvent });
    } catch (error) {
        res.status(500).json({ sucess: false, error: error.message });
    }
};

exports.getAllEvents = async (req, res) => {
    try {
        const events = await Event.find({ schoolId: req.user.schoolId });
        console.log("events", events)
        res.status(200).json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.eventId,
            req.body,
            { new: true }
        );
        res.status(200).json(updatedEvent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const deletedEvent = await Event.findByIdAndDelete(req.params.eventId);
        res.status(200).json(deletedEvent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
