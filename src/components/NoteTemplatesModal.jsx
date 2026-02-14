import React, { useState } from 'react'
import {
  X,
  FileText,
  CheckSquare,
  Calendar,
  Users,
  Lightbulb,
  Target,
  BookOpen,
  Code,
  ShoppingCart,
  Heart,
  GraduationCap,
  Plane,
  Receipt,
  Dumbbell,
  Utensils
} from 'lucide-react'
import { useUIStore, useNotesStore } from '../store'

const getDate = () => new Date().toLocaleDateString()
const getFullDate = () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const getWeekStart = () => {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(now.setDate(diff)).toLocaleDateString()
}

const NOTE_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Note',
    icon: FileText,
    color: '#6b7280',
    description: 'Start with a clean slate',
    content: '',
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    icon: Users,
    color: '#3b82f6',
    description: 'Structured meeting documentation',
    content: `<h1>Meeting Notes</h1>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb; width: 120px;"><strong>Meeting Title:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Date:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">${getDate()}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Time:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Location:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Facilitator:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
</table>

<h2>Attendees</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Name</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Role</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Attendance</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Present</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Present</td>
  </tr>
</table>

<h2>Agenda</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Topic</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Presenter</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Time</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Status</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Opening & Introductions</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">10 min</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Pending</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Main Discussion</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">30 min</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Pending</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Q&A and Next Steps</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">15 min</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Pending</td>
  </tr>
</table>

<h2>Discussion Notes</h2>
<h3>Opening & Introductions</h3>
<p>Key points discussed:</p>
<ul>
  <li></li>
</ul>

<h3>Main Discussion</h3>
<p>Key points discussed:</p>
<ul>
  <li></li>
</ul>

<h3>Q&A and Next Steps</h3>
<p>Key points discussed:</p>
<ul>
  <li></li>
</ul>

<h2>Action Items</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Action Item</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Owner</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Due Date</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Status</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Pending</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Pending</td>
  </tr>
</table>

<h2>Key Decisions</h2>
<p>Important decisions made during this meeting:</p>
<ul>
  <li></li>
</ul>

<h2>Next Meeting</h2>
<p><strong>Scheduled for:</strong> </p>
<p><strong>Topics to cover:</strong> </p>`,
  },
  {
    id: 'todo',
    name: 'To-Do List',
    icon: CheckSquare,
    color: '#22c55e',
    description: 'Prioritized task management',
    content: `<h1>Task Management Dashboard</h1>
<p><em>Date: ${getFullDate()}</em></p>

<h2>Daily Focus</h2>
<p><strong>Main Objective:</strong> </p>
<p><em>What is the ONE thing that will make today successful?</em></p>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Priority Matrix</h2>

<h3>\u{1F534} Critical & Urgent</h3>
<p><em>Do these first - they impact immediate goals</em></p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Task:</strong> </p></div></li>
</ul>

<h3>\u{1F7E1} Important but Not Urgent</h3>
<p><em>Schedule these - they support long-term goals</em></p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h3>\u{1F7E2} Low Priority</h3>
<p><em>Do these when time allows</em></p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Communication Tasks</h2>

<h3>Phone Calls</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h3>Email Tasks</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Progress Summary</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Category</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Completed</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Total</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Progress</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Critical Tasks</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">0</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">0%</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Important Tasks</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">0</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">0%</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Communication</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">0</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">0%</td>
  </tr>
</table>

<h3>Time Tracking</h3>
<p><strong>Time spent on tasks:</strong> ___ hours</p>
<p><strong>Most productive time:</strong> </p>

<h3>Notes & Reflections</h3>
<p>What went well today?</p>
<p></p>
<p>What could be improved?</p>
<p></p>`,
  },
  {
    id: 'daily',
    name: 'Daily Journal',
    icon: Calendar,
    color: '#f59e0b',
    description: 'Mindful daily reflection',
    content: `<h1>\u{1F4D6} Daily Journal</h1>
<p style="text-align: center; font-size: 1.2em;"><em>${getFullDate()}</em></p>

<h2>\u{1F305} Morning Check-in</h2>
<p><strong>How I'm feeling (1-10):</strong> \u2B50\u2B50\u2B50\u2B50\u2B50\u2B50\u2B50\u2B50\u2B50\u2B50</p>
<p><strong>Energy level:</strong> \u{1F50B}\u{1F50B}\u{1F50B}\u{1F50B}\u{1F50B}</p>
<p><strong>One word for today:</strong> </p>

<h2>\u{1F3AF} Today's Intentions</h2>
<ol>
  <li><strong>Main goal:</strong> </li>
  <li><strong>Secondary goal:</strong> </li>
  <li><strong>Bonus:</strong> </li>
</ol>

<h2>\u{1F4C5} Schedule</h2>
<table>
  <tr><th>Time</th><th>Activity</th><th>Notes</th></tr>
  <tr><td>Morning</td><td></td><td></td></tr>
  <tr><td>Afternoon</td><td></td><td></td></tr>
  <tr><td>Evening</td><td></td><td></td></tr>
</table>

<h2>\u{1F319} Evening Reflection</h2>
<p><strong>Three wins today:</strong></p>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

<p><strong>What challenged me:</strong></p>
<p></p>

<p><strong>What I learned:</strong></p>
<p></p>

<h2>\u{1F64F} Gratitude</h2>
<p>Today I'm grateful for:</p>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

<h2>\u{1F4AD} Free Writing</h2>
<p><em>Let your thoughts flow...</em></p>
<p></p>`,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorming',
    icon: Lightbulb,
    color: '#eab308',
    description: 'Creative idea generation',
    content: `<h1>Brainstorming Session</h1>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb; width: 120px;"><strong>Topic:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb; background-color: #fef3c7;"><mark style="background-color: #fef08a;">Define your challenge here</mark></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Date:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">${getDate()}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Time Limit:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">25 minutes</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Goal:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Generate 20+ ideas</td>
  </tr>
</table>

<h2>Challenge Statement</h2>
<p style="font-style: italic; padding: 15px; background-color: #f9fafb; border-left: 4px solid #3b82f6;">How might we <strong>[rephrase your challenge as a question]</strong>?</p>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Idea Generation</h2>
<p><em>Write down EVERY idea that comes to mind. No filtering or judgment. Quantity over quality.</em></p>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
  <div>
    <h3>Column 1</h3>
    <ul>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
    </ul>
  </div>
  <div>
    <h3>Column 2</h3>
    <ul>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
    </ul>
  </div>
</div>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Idea Evaluation</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Idea</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Impact<br/>(1-5)</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Effort<br/>(1-5)</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Score<br/>(Impact/Effort)</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Notes</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Top Idea 1</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Top Idea 2</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Top Idea 3</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
</table>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Selected Idea Deep Dive</h2>
<h3>Chosen Idea</h3>
<p><strong>Selected:</strong> </p>

<h3>Why This Idea?</h3>
<ul>
  <li></li>
  <li></li>
</ul>

<h3>Potential Challenges</h3>
<ul>
  <li></li>
  <li></li>
</ul>

<h3>Next Steps</h3>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

<h3>Action Plan</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>This week:</strong> </p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>This month:</strong> </p></div></li>
</ul>`,
  },
  {
    id: 'project',
    name: 'Project Plan',
    icon: Target,
    color: '#8b5cf6',
    description: 'Comprehensive project planning',
    content: `<h1>Project Management Plan</h1>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb; width: 150px;"><strong>Project Name:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Project Manager:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Start Date:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">${getDate()}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Target Completion:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Current Status:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Planning Phase</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Budget:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
</table>

<h2>Executive Summary</h2>
<p><strong>Project Vision:</strong></p>
<p style="font-style: italic; padding: 15px; background-color: #f9fafb; border-left: 4px solid #8b5cf6;">What does success look like? Describe the end result and business value.</p>

<h2>Objectives & Success Criteria</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Objective</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Success Criteria</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Priority</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Objective 1</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Specific, measurable criteria</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">High</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Objective 2</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Specific, measurable criteria</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Medium</td>
  </tr>
</table>

<h2>Team & Stakeholders</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Name</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Role</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Responsibilities</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Contact</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
</table>

<h2>Project Timeline</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Phase</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Milestones</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Start Date</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">End Date</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Status</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Planning</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Requirements gathering, resource allocation</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Active</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Execution</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Core development/implementation</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Not Started</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Testing</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Quality assurance, bug fixes</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Not Started</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Launch</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Deployment and handover</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Not Started</td>
  </tr>
</table>

<h2>Deliverables</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Deliverable 1: Description and acceptance criteria</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Deliverable 2: Description and acceptance criteria</p></div></li>
</ul>

<h2>Risk Assessment</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Risk</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Probability</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Impact</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Mitigation Strategy</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Resource constraints</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Medium</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">High</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Cross-train team members, maintain resource buffer</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Scope creep</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Medium</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Medium</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Strict change control process</td>
  </tr>
</table>

<h2>Communication Plan</h2>
<ul>
  <li><strong>Weekly Status Meetings:</strong> Every Friday, 2:00 PM</li>
  <li><strong>Progress Reports:</strong> Bi-weekly to stakeholders</li>
  <li><strong>Issue Escalation:</strong> Immediate notification to project manager</li>
</ul>

<h2>Budget & Resources</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Resource Type</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Allocated</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Required</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Status</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Team Members</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Secured</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Tools & Software</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Pending</td>
  </tr>
</table>`,
  },
  {
    id: 'study',
    name: 'Study Notes',
    icon: GraduationCap,
    color: '#06b6d4',
    description: 'Effective learning & retention',
    content: `<h1>Study Notes - Cornell Method</h1>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb; width: 120px;"><strong>Subject:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Topic:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Source:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Date:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">${getDate()}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Study Time:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">___ minutes</td>
  </tr>
</table>

<h2>Learning Objectives</h2>
<p><em>By the end of this study session, I will understand:</em></p>
<ul>
  <li></li>
  <li></li>
  <li></li>
</ul>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<div style="display: grid; grid-template-columns: 3fr 1fr; gap: 20px;">
  <div>
    <h2>Main Notes</h2>
    <p><em>Record key facts, concepts, and ideas here. Use bullet points, diagrams, or any format that helps you understand.</em></p>
    
    <h3>Key Concept 1</h3>
    <p><strong>Definition:</strong> </p>
    <p><strong>In my own words:</strong> </p>
    <p><strong>Example:</strong> </p>
    
    <h3>Key Concept 2</h3>
    <p><strong>Definition:</strong> </p>
    <p><strong>In my own words:</strong> </p>
    <p><strong>Example:</strong> </p>
    
    <h3>Important Details</h3>
    <ul>
      <li></li>
      <li></li>
      <li></li>
    </ul>
    
    <h3>Formulas / Rules</h3>
    <div style="background-color: #f9fafb; padding: 15px; border-left: 4px solid #06b6d4; margin: 10px 0;">
      <p><code>Formula/Rule: [equation or rule here]</code></p>
      <p><strong>When to use:</strong> </p>
      <p><strong>Example:</strong> </p>
    </div>
  </div>
  
  <div>
    <h2>Cues</h2>
    <p><em>Write questions, keywords, or prompts that will help you recall the information.</em></p>
    <ul>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
      <li></li>
    </ul>
  </div>
</div>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Summary</h2>
<p><em>Summarize the main ideas in 3-5 sentences. Cover the most important points.</em></p>
<p></p>
<p></p>
<p></p>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Connections & Applications</h2>
<p><strong>How does this relate to what I already know?</strong></p>
<ul>
  <li></li>
  <li></li>
</ul>

<p><strong>Real-world applications:</strong></p>
<ul>
  <li></li>
  <li></li>
</ul>

<h2>Questions for Further Study</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h2>Self-Assessment</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Understanding Level</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Before Study</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">After Study</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Topic comprehension</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">1  2  3  4  5</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">1  2  3  4  5</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Ability to explain concepts</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">1  2  3  4  5</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">1  2  3  4  5</td>
  </tr>
</table>

<h3>Study Session Reflection</h3>
<p><strong>What went well?</strong></p>
<p></p>
<p><strong>What needs more review?</strong></p>
<p></p>`,
  },
  {
    id: 'code',
    name: 'Code Documentation',
    icon: Code,
    color: '#64748b',
    description: 'Technical documentation template',
    content: `<h1>Code Documentation</h1>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb; width: 120px;"><strong>Component/Module:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Author:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Language:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Version:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">1.0.0</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Last Updated:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">${getDate()}</td>
  </tr>
</table>

<h2>Overview</h2>
<p><strong>Purpose:</strong> What does this code do? What problem does it solve?</p>
<p></p>

<p><strong>Scope:</strong> What is included and what is not?</p>
<p></p>

<h2>Architecture & Design</h2>
<p><strong>Design Pattern:</strong> </p>
<p></p>

<p><strong>Key Classes/Functions:</strong></p>
<ul>
  <li></li>
  <li></li>
</ul>

<h2>Dependencies</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Dependency</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Version</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Purpose</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
</table>

<h2>API Reference</h2>

<h3>Functions</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Function</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Parameters</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Return Type</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Description</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><code>functionName()</code></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">param1: type, param2: type</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">returnType</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Brief description</td>
  </tr>
</table>

<h3>Data Structures</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Property</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Type</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Required</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Description</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><code>propertyName</code></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">string</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Yes</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Description of the property</td>
  </tr>
</table>

<h2>Implementation</h2>
<p><strong>Key Algorithms:</strong></p>
<p></p>

<p><strong>Performance Considerations:</strong></p>
<ul>
  <li></li>
  <li></li>
</ul>

<h3>Code Example</h3>
<pre style="background-color: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-radius: 4px;"><code>// Example usage
function example() {
  return result;
}</code></pre>

<h2>Testing</h2>

<h3>Unit Tests</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Test Case</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Input</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Expected Output</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Status</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Basic functionality</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Valid input</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Expected result</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Pass</td>
  </tr>
</table>

<h3>Error Handling</h3>
<ul>
  <li><strong>Input validation:</strong> </li>
  <li><strong>Exception handling:</strong> </li>
  <li><strong>Edge cases:</strong> </li>
</ul>

<h2>Maintenance & Updates</h2>
<p><strong>Known Issues:</strong></p>
<ul>
  <li></li>
</ul>

<p><strong>Future Improvements:</strong></p>
<ul>
  <li></li>
</ul>

<h2>References</h2>
<ul>
  <li><a href="">API Documentation Link</a></li>
  <li><a href="">Related Components</a></li>
  <li><a href="">External Resources</a></li>
</ul>`,
  },
  {
    id: 'shopping',
    name: 'Shopping List',
    icon: ShoppingCart,
    color: '#ec4899',
    description: 'Organized shopping with budget tracking',
    content: `<h1>Shopping List</h1>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb; width: 120px;"><strong>Date:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">${getDate()}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Store:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Budget:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Shopping for:</strong></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
  </tr>
</table>

<h2>Budget Overview</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Category</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Allocated</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Spent</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Remaining</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Groceries</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Household</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">Personal Care</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
  </tr>
  <tr style="background-color: #f9fafb; font-weight: bold;">
    <td style="padding: 8px; border: 1px solid #e5e7eb;">TOTAL</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
  </tr>
</table>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Shopping List by Category</h2>

<h3>Produce & Fresh Foods</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Item</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Quantity</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Est. Price</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">\u2713</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">\u2610</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">\u2610</td>
  </tr>
</table>

<h3>Meat & Protein</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h3>Dairy & Refrigerated</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h3>Bakery & Bread</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h3>Pantry Staples</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h3>Household & Cleaning</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h3>Personal Care</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">

<h2>Store Layout Plan</h2>
<p><em>Plan your route through the store for efficiency</em></p>
<ol>
  <li><strong>Entrance:</strong> Produce section</li>
  <li><strong>Middle aisles:</strong> Pantry staples</li>
  <li><strong>Back wall:</strong> Meat, dairy, frozen</li>
  <li><strong>Front checkout:</strong> Any forgotten items</li>
</ol>

<h2>Coupons & Savings</h2>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f9fafb;">
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Item</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Coupon Value</th>
    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Used</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">$</td>
    <td style="padding: 8px; border: 1px solid #e5e7eb;">\u2610</td>
  </tr>
</table>

<h2>Post-Shopping Notes</h2>
<p><strong>Actual total spent:</strong> $</p>
<p><strong>Items forgotten:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Unexpected finds:</strong></p>
<ul>
  <li></li>
</ul>`,
  },
  {
    id: 'travel',
    name: 'Travel Planner',
    icon: Plane,
    color: '#14b8a6',
    description: 'Complete trip planning guide',
    content: `<h1>\u2708\uFE0F Travel Planner</h1>

<table>
  <tr><td style="width: 150px;"><strong>Destination:</strong></td><td></td></tr>
  <tr><td><strong>Dates:</strong></td><td>From: ___ To: ___</td></tr>
  <tr><td><strong>Duration:</strong></td><td>___ days</td></tr>
  <tr><td><strong>Travelers:</strong></td><td></td></tr>
</table>

<h2>\u{1F4CB} Pre-Trip Checklist</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Passport valid (6+ months)</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Visa requirements checked</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Travel insurance</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Vaccinations</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Notify bank of travel</p></div></li>
</ul>

<h2>\u{1F3AB} Bookings</h2>
<table>
  <tr><th>Type</th><th>Details</th><th>Confirmation #</th><th>Cost</th></tr>
  <tr><td>\u2708\uFE0F Flight Out</td><td></td><td></td><td>$</td></tr>
  <tr><td>\u2708\uFE0F Flight Return</td><td></td><td></td><td>$</td></tr>
  <tr><td>\u{1F3E8} Hotel</td><td></td><td></td><td>$</td></tr>
  <tr><td>\u{1F697} Car Rental</td><td></td><td></td><td>$</td></tr>
</table>

<h2>\u{1F5D3}\uFE0F Itinerary</h2>
<h3>Day 1 - Arrival</h3>
<ul>
  <li><strong>Morning:</strong> </li>
  <li><strong>Afternoon:</strong> </li>
  <li><strong>Evening:</strong> </li>
  <li><strong>Dinner:</strong> </li>
</ul>

<h3>Day 2</h3>
<ul>
  <li><strong>Morning:</strong> </li>
  <li><strong>Afternoon:</strong> </li>
  <li><strong>Evening:</strong> </li>
</ul>

<h2>\u{1F4CD} Places to Visit</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Must See:</strong> </p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>If Time:</strong> </p></div></li>
</ul>

<h2>\u{1F37D}\uFE0F Restaurants to Try</h2>
<ul>
  <li><strong>Name:</strong>  | <strong>Cuisine:</strong>  | <strong>Price:</strong> $$</li>
</ul>

<h2>\u{1F392} Packing List</h2>
<h3>Essentials</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Passport & ID</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Phone & charger</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Wallet & cards</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Medications</p></div></li>
</ul>

<h3>Clothing</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>

<h2>\u{1F4B0} Budget</h2>
<table>
  <tr><th>Category</th><th>Budgeted</th><th>Actual</th></tr>
  <tr><td>Flights</td><td>$</td><td>$</td></tr>
  <tr><td>Accommodation</td><td>$</td><td>$</td></tr>
  <tr><td>Food & Drinks</td><td>$</td><td>$</td></tr>
  <tr><td>Activities</td><td>$</td><td>$</td></tr>
  <tr><td>Transport</td><td>$</td><td>$</td></tr>
  <tr><td>Shopping</td><td>$</td><td>$</td></tr>
  <tr><td><strong>TOTAL</strong></td><td><strong>$</strong></td><td><strong>$</strong></td></tr>
</table>

<h2>\u{1F4DD} Important Notes</h2>
<ul>
  <li><strong>Emergency Contact:</strong> </li>
  <li><strong>Hotel Address:</strong> </li>
  <li><strong>Local Currency:</strong> </li>
</ul>`,
  },
  {
    id: 'weekly',
    name: 'Weekly Review',
    icon: BookOpen,
    color: '#f97316',
    description: 'Comprehensive week reflection',
    content: `<h1>\u{1F4C5} Weekly Review</h1>
<p style="text-align: center;"><em>Week of ${getWeekStart()}</em></p>

<h2>\u2B50 Week Rating</h2>
<p><strong>Overall:</strong> \u2B50\u2B50\u2B50\u2B50\u2B50 / 5</p>
<p><strong>Productivity:</strong> \u2B50\u2B50\u2B50\u2B50\u2B50 / 5</p>
<p><strong>Energy:</strong> \u2B50\u2B50\u2B50\u2B50\u2B50 / 5</p>
<p><strong>Mood:</strong> \u2B50\u2B50\u2B50\u2B50\u2B50 / 5</p>

<h2>\u{1F3AF} Last Week's Goals - Review</h2>
<table>
  <tr><th>Goal</th><th>Status</th><th>Notes</th></tr>
  <tr><td></td><td>\u2705 Done / \u23F3 Partial / \u274C Not Done</td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
</table>

<h2>\u{1F3C6} Top Wins This Week</h2>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

<h2>\u{1F4CA} Projects Progress</h2>
<table>
  <tr><th>Project</th><th>Progress</th><th>Next Steps</th></tr>
  <tr><td></td><td>\u{1F7E2}\u{1F7E2}\u{1F7E2}\u26AA\u26AA 60%</td><td></td></tr>
</table>

<h2>\u{1F624} Challenges Faced</h2>
<ul>
  <li><strong>Challenge:</strong> </li>
  <li><strong>How I handled it:</strong> </li>
  <li><strong>Lesson:</strong> </li>
</ul>

<h2>\u{1F4A1} Key Insights & Learnings</h2>
<blockquote><p>What did this week teach me?</p></blockquote>

<h2>\u{1F64F} Gratitude List</h2>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

<h2>\u{1F3AF} Goals for Next Week</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Priority 1:</strong> </p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Priority 2:</strong> </p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>Priority 3:</strong> </p></div></li>
</ul>

<h2>\u{1F527} Improvements for Next Week</h2>
<p>What will I do differently?</p>
<ul>
  <li></li>
</ul>`,
  },
  {
    id: 'habit',
    name: 'Habit Tracker',
    icon: Heart,
    color: '#ef4444',
    description: 'Daily habit tracking calendar',
    content: `<h1>\u{1F4CA} Habit Tracker</h1>
<p style="text-align: center;"><strong>Month:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>

<h2>\u{1F3AF} Monthly Goals</h2>
<blockquote><p>What habits do I want to build this month?</p></blockquote>

<h2>\u{1F4CB} Habits to Track</h2>
<table>
  <tr><th>Habit</th><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th><th>S</th><th>Score</th></tr>
  <tr><td>\u{1F4A7} 8 glasses water</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>/7</td></tr>
  <tr><td>\u{1F3C3} 30min exercise</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>/7</td></tr>
  <tr><td>\u{1F4DA} Read 30min</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>/7</td></tr>
  <tr><td>\u{1F634} Sleep 7-8h</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>/7</td></tr>
  <tr><td>\u{1F9D8} Meditate 10min</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>/7</td></tr>
  <tr><td>\u{1F957} Healthy eating</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>/7</td></tr>
  <tr><td>\u{1F4F1} No phone 1h bed</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>\u2B1C</td><td>/7</td></tr>
</table>
<p><em>\u2B1C = Not done | \u2705 = Done | \u{1F7E1} = Partial</em></p>

<h2>\u{1F4C8} Weekly Statistics</h2>
<table>
  <tr><th>Week</th><th>Completion Rate</th><th>Best Habit</th><th>Focus Area</th></tr>
  <tr><td>Week 1</td><td>__%</td><td></td><td></td></tr>
  <tr><td>Week 2</td><td>__%</td><td></td><td></td></tr>
  <tr><td>Week 3</td><td>__%</td><td></td><td></td></tr>
  <tr><td>Week 4</td><td>__%</td><td></td><td></td></tr>
</table>

<h2>\u{1F3C5} Streaks</h2>
<ul>
  <li>\u{1F4A7} Water: ___ days</li>
  <li>\u{1F3C3} Exercise: ___ days</li>
  <li>\u{1F4DA} Reading: ___ days</li>
</ul>

<h2>\u{1F4AD} Reflections</h2>
<p><strong>What's working well?</strong></p>
<p></p>

<p><strong>What needs adjustment?</strong></p>
<p></p>

<h2>\u{1F381} Reward System</h2>
<ul>
  <li><strong>7-day streak:</strong> </li>
  <li><strong>30-day streak:</strong> </li>
</ul>`,
  },
  {
    id: 'recipe',
    name: 'Recipe Card',
    icon: Utensils,
    color: '#84cc16',
    description: 'Save your favorite recipes',
    content: `<h1>\u{1F373} Recipe Card</h1>

<h2 style="text-align: center; font-size: 1.5em;"><em>Recipe Name</em></h2>

<table>
  <tr><td style="width: 120px;"><strong>\u23F1\uFE0F Prep Time:</strong></td><td>___ min</td></tr>
  <tr><td><strong>\u{1F525} Cook Time:</strong></td><td>___ min</td></tr>
  <tr><td><strong>\u{1F465} Servings:</strong></td><td></td></tr>
  <tr><td><strong>\u{1F4CA} Difficulty:</strong></td><td>\u2B50\u2B50\u2B50 Easy/Medium/Hard</td></tr>
</table>

<h2>\u{1F4DD} Description</h2>
<p><em>A brief description of this dish...</em></p>

<h2>\u{1F6D2} Ingredients</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>1 cup </p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>2 tbsp </p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>1/2 tsp </p></div></li>
</ul>

<h2>\u{1F468}\u200D\u{1F373} Instructions</h2>
<ol>
  <li><strong>Prep:</strong> </li>
  <li><strong>Step 2:</strong> </li>
  <li><strong>Step 3:</strong> </li>
  <li><strong>Final:</strong> </li>
</ol>

<h2>\u{1F4A1} Tips & Variations</h2>
<ul>
  <li><strong>Tip:</strong> </li>
  <li><strong>Variation:</strong> </li>
  <li><strong>Storage:</strong> </li>
</ul>

<h2>\u{1F4CA} Nutrition (per serving)</h2>
<table>
  <tr><td>Calories</td><td></td></tr>
  <tr><td>Protein</td><td>g</td></tr>
  <tr><td>Carbs</td><td>g</td></tr>
  <tr><td>Fat</td><td>g</td></tr>
</table>

<h2>\u2B50 Rating & Notes</h2>
<p><strong>My Rating:</strong> \u2B50\u2B50\u2B50\u2B50\u2B50</p>
<p><strong>Notes:</strong> </p>`,
  },
  {
    id: 'fitness',
    name: 'Workout Log',
    icon: Dumbbell,
    color: '#f43f5e',
    description: 'Track your fitness progress',
    content: `<h1>\u{1F4AA} Workout Log</h1>
<p><strong>Date:</strong> ${getDate()} | <strong>Day:</strong> </p>

<h2>\u{1F3AF} Today's Focus</h2>
<p><strong>Workout Type:</strong> <mark style="background-color: #fef08a;">Strength / Cardio / HIIT / Yoga / Rest</mark></p>
<p><strong>Duration:</strong> ___ min</p>
<p><strong>Energy Level:</strong> \u{1F50B}\u{1F50B}\u{1F50B}\u{1F50B}\u{1F50B}</p>

<h2>\u{1F3CB}\uFE0F Warm-up (5-10 min)</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Light cardio</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Dynamic stretches</p></div></li>
</ul>

<h2>\u{1F3AF} Main Workout</h2>
<table>
  <tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th><th>Notes</th></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
</table>

<h2>\u{1F3C3} Cardio</h2>
<table>
  <tr><th>Activity</th><th>Duration</th><th>Distance</th><th>Pace/Speed</th></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
</table>

<h2>\u{1F9D8} Cool-down (5-10 min)</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Static stretches</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Foam rolling</p></div></li>
</ul>

<h2>\u{1F4CA} Stats</h2>
<table>
  <tr><td style="width: 150px;"><strong>Calories Burned:</strong></td><td></td></tr>
  <tr><td><strong>Heart Rate (avg):</strong></td><td>bpm</td></tr>
  <tr><td><strong>Heart Rate (max):</strong></td><td>bpm</td></tr>
</table>

<h2>\u{1F4AD} Post-Workout Notes</h2>
<p><strong>How I felt:</strong> </p>
<p><strong>Personal Records:</strong> </p>
<p><strong>Areas to improve:</strong> </p>

<h2>\u{1F957} Nutrition</h2>
<p><strong>Pre-workout meal:</strong> </p>
<p><strong>Post-workout meal:</strong> </p>
<p><strong>Water intake:</strong> ___ L</p>`,
  },
  {
    id: 'budget',
    name: 'Monthly Budget',
    icon: Receipt,
    color: '#0ea5e9',
    description: 'Financial planning template',
    content: `<h1>\u{1F4B0} Monthly Budget</h1>
<p style="text-align: center;"><strong>${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong></p>

<h2>\u{1F4CA} Income Overview</h2>
<table>
  <tr><th>Source</th><th>Expected</th><th>Actual</th></tr>
  <tr><td>\u{1F4BC} Salary</td><td>$</td><td>$</td></tr>
  <tr><td>\u{1F4C8} Investments</td><td>$</td><td>$</td></tr>
  <tr><td>\u{1F381} Other</td><td>$</td><td>$</td></tr>
  <tr><td><strong>TOTAL INCOME</strong></td><td><strong>$</strong></td><td><strong>$</strong></td></tr>
</table>

<h2>\u{1F4E4} Fixed Expenses</h2>
<table>
  <tr><th>Category</th><th>Budgeted</th><th>Actual</th><th>Status</th></tr>
  <tr><td>\u{1F3E0} Rent/Mortgage</td><td>$</td><td>$</td><td>\u2705</td></tr>
  <tr><td>\u26A1 Utilities</td><td>$</td><td>$</td><td></td></tr>
  <tr><td>\u{1F4F1} Phone/Internet</td><td>$</td><td>$</td><td></td></tr>
  <tr><td>\u{1F697} Car/Transport</td><td>$</td><td>$</td><td></td></tr>
  <tr><td>\u{1F3E5} Insurance</td><td>$</td><td>$</td><td></td></tr>
  <tr><td>\u{1F4FA} Subscriptions</td><td>$</td><td>$</td><td></td></tr>
</table>

<h2>\u{1F6D2} Variable Expenses</h2>
<table>
  <tr><th>Category</th><th>Budgeted</th><th>Actual</th><th>Remaining</th></tr>
  <tr><td>\u{1F355} Food & Groceries</td><td>$</td><td>$</td><td>$</td></tr>
  <tr><td>\u26FD Gas</td><td>$</td><td>$</td><td>$</td></tr>
  <tr><td>\u{1F389} Entertainment</td><td>$</td><td>$</td><td>$</td></tr>
  <tr><td>\u{1F455} Clothing</td><td>$</td><td>$</td><td>$</td></tr>
  <tr><td>\u{1F48A} Health</td><td>$</td><td>$</td><td>$</td></tr>
  <tr><td>\u{1F381} Misc</td><td>$</td><td>$</td><td>$</td></tr>
</table>

<h2>\u{1F48E} Savings Goals</h2>
<table>
  <tr><th>Goal</th><th>Target</th><th>This Month</th><th>Progress</th></tr>
  <tr><td>\u{1F3E6} Emergency Fund</td><td>$</td><td>$</td><td>\u{1F7E2}\u{1F7E2}\u{1F7E2}\u26AA\u26AA 60%</td></tr>
  <tr><td>\u2708\uFE0F Vacation</td><td>$</td><td>$</td><td></td></tr>
  <tr><td>\u{1F393} Other</td><td>$</td><td>$</td><td></td></tr>
</table>

<h2>\u{1F4C8} Monthly Summary</h2>
<table>
  <tr><td style="width: 200px;"><strong>Total Income:</strong></td><td>$</td></tr>
  <tr><td><strong>Total Expenses:</strong></td><td>$</td></tr>
  <tr><td><strong>Total Savings:</strong></td><td>$</td></tr>
  <tr><td style="background-color: #dcfce7;"><strong>Net Balance:</strong></td><td style="background-color: #dcfce7;"><strong>$</strong></td></tr>
</table>

<h2>\u{1F4AD} Notes & Adjustments</h2>
<p></p>`,
  },
]

export default function NoteTemplatesModal() {
  const { templatesModalOpen, setTemplatesModalOpen } = useUIStore()
  const { createNote, setSelectedNoteId } = useNotesStore()
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  if (!templatesModalOpen) return null

  const handleCreateFromTemplate = (template) => {
    const newNote = createNote({
      title: template.name === 'Blank Note' ? 'New Note' : template.name,
      content: template.content,
    })
    setSelectedNoteId(newNote.id)
    setTemplatesModalOpen(false)
    setSelectedTemplate(null)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm modal-backdrop-animate"
        onClick={() => setTemplatesModalOpen(false)}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Note Templates</h2>
              <p className="text-sm text-white/70">Choose a template to get started quickly</p>
            </div>
          </div>
          <button
            onClick={() => setTemplatesModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {NOTE_TEMPLATES.map((template) => {
              const Icon = template.icon
              return (
                <button
                  key={template.id}
                  onClick={() => handleCreateFromTemplate(template)}
                  onMouseEnter={() => setSelectedTemplate(template)}
                  onMouseLeave={() => setSelectedTemplate(null)}
                  className={`p-4 rounded-xl border-2 transition-all text-left hover:scale-105 ${
                    selectedTemplate?.id === template.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${template.color}20`, color: template.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                    {template.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {template.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
        <div className="p-6 border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click on a template to create a new note
            </p>
            <button
              onClick={() => setTemplatesModalOpen(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
