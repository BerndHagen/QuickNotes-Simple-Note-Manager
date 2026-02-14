import React, { useState } from 'react'
import { X, FileText, CheckSquare, Calendar, Code, Briefcase, BookOpen } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'

const templates = [
  {
    id: 'blank',
    name: 'Blank Note',
    description: 'Start with an empty note',
    icon: FileText,
    content: '',
  },
  {
    id: 'todo',
    name: 'To-Do List',
    description: 'Simple task list',
    icon: CheckSquare,
    content: `<h2>\u{1F4CB} To-Do List</h2>
<p>Date: ${new Date().toLocaleDateString('en-US')}</p>
<h3>Urgent</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Task 1</li>
  <li data-type="taskItem" data-checked="false">Task 2</li>
</ul>
<h3>This Week</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Task 3</li>
  <li data-type="taskItem" data-checked="false">Task 4</li>
</ul>
<h3>Later</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Task 5</li>
</ul>`,
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Template for meetings',
    icon: Calendar,
    content: `<h2>\u{1F4C5} Meeting Notes</h2>
<p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
<p><strong>Attendees:</strong> </p>
<p><strong>Topic:</strong> </p>
<hr>
<h3>Agenda</h3>
<ol>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ol>
<h3>Discussion</h3>
<p></p>
<h3>Decisions</h3>
<ul>
  <li></li>
</ul>
<h3>Action Items</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Action 1 - Owner: </li>
  <li data-type="taskItem" data-checked="false">Action 2 - Owner: </li>
</ul>`,
  },
  {
    id: 'project',
    name: 'Project Planning',
    description: 'Structure for project ideas',
    icon: Briefcase,
    content: `<h2>\u{1F680} Project Name</h2>
<p><strong>Start:</strong> ${new Date().toLocaleDateString('en-US')}</p>
<p><strong>Deadline:</strong> </p>
<hr>
<h3>Goal</h3>
<p>What should be achieved?</p>
<h3>Scope</h3>
<ul>
  <li>Feature 1</li>
  <li>Feature 2</li>
  <li>Feature 3</li>
</ul>
<h3>Milestones</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Milestone 1 - Date: </li>
  <li data-type="taskItem" data-checked="false">Milestone 2 - Date: </li>
  <li data-type="taskItem" data-checked="false">Milestone 3 - Date: </li>
</ul>
<h3>Resources</h3>
<ul>
  <li>Team: </li>
  <li>Budget: </li>
  <li>Tools: </li>
</ul>
<h3>Risks</h3>
<ul>
  <li></li>
</ul>`,
  },
  {
    id: 'code',
    name: 'Code Snippet',
    description: 'For code documentation',
    icon: Code,
    content: `<h2>\u{1F4BB} Code Snippet</h2>
<p><strong>Language:</strong> </p>
<p><strong>Purpose:</strong> </p>
<hr>
<h3>Description</h3>
<p>What does this code do?</p>
<h3>Code</h3>
<pre><code class="language-javascript">// Your code here
function example() {
  return 'Hello World';
}</code></pre>
<h3>Usage</h3>
<pre><code class="language-javascript">// Example call
const result = example();
console.log(result);</code></pre>
<h3>Notes</h3>
<ul>
  <li></li>
</ul>`,
  },
  {
    id: 'journal',
    name: 'Daily Journal',
    description: 'Daily reflection',
    icon: BookOpen,
    content: `<h2>\u{1F4D4} ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
<hr>
<h3>\u{1F305} Today I'm grateful for...</h3>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>
<h3>\u{1F3AF} What I want to achieve today</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Priority 1</li>
  <li data-type="taskItem" data-checked="false">Priority 2</li>
  <li data-type="taskItem" data-checked="false">Priority 3</li>
</ul>
<h3>\u{1F4AD} Thoughts & Reflection</h3>
<p></p>
<h3>\u{1F319} Daily Review</h3>
<p><strong>What went well:</strong> </p>
<p><strong>What can I improve:</strong> </p>
<p><strong>Mood (1-10):</strong> </p>`,
  },
]

export default function TemplateModal() {
  const { templateModalOpen, setTemplateModalOpen } = useUIStore()
  const { createNote, selectedFolderId } = useNotesStore()

  const handleSelectTemplate = (template) => {
    createNote({
      title: template.name === 'Blank Note' ? 'New Note' : template.name,
      content: template.content,
      folderId: selectedFolderId,
    })
    setTemplateModalOpen(false)
  }

  if (!templateModalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Choose a Template</h2>
              <p className="text-sm text-white/70">Start with a pre-built structure</p>
            </div>
          </div>
          <button
            onClick={() => setTemplateModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-2 gap-4">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="p-4 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
                    <template.icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {template.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
