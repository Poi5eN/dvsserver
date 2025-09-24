const mongoose = require('mongoose');

const gradeEntrySchema = new mongoose.Schema({
  grade: {
    type: String,
    required: true,
    trim: true
  },
  minMarks: {
    type: Number,
    min: 0,
    max: 100
  },
  maxMarks: {
    type: Number,
    min: 0,
    max: 100
  },
  description: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const coScholasticGradeSchema = new mongoose.Schema({
  grade: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const gradeSettingsSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    unique: true
  },
  scholastic: {
    type: [gradeEntrySchema],
    required: true,
    default: [
      { grade: "A+", minMarks: 91, maxMarks: 100, description: "Outstanding" },
      { grade: "A", minMarks: 81, maxMarks: 90, description: "Excellent" },
      { grade: "B+", minMarks: 71, maxMarks: 80, description: "Very Good" },
      { grade: "B", minMarks: 61, maxMarks: 70, description: "Good" },
      { grade: "C+", minMarks: 51, maxMarks: 60, description: "Satisfactory" },
      { grade: "C", minMarks: 41, maxMarks: 50, description: "Acceptable" },
      { grade: "D", minMarks: 33, maxMarks: 40, description: "Needs Improvement" },
      { grade: "E", minMarks: 0, maxMarks: 32, description: "Unsatisfactory" }
    ]
  },
  coScholastic: {
    type: [coScholasticGradeSchema],
    required: true,
    default: [
      { grade: "A+", description: "Outstanding Performance" },
      { grade: "A", description: "Excellent Performance" },
      { grade: "B+", description: "Very Good Performance" },
      { grade: "B", description: "Good Performance" },
      { grade: "C+", description: "Satisfactory Performance" },
      { grade: "C", description: "Acceptable Performance" },
      { grade: "D", description: "Needs Improvement" },
      { grade: "E", description: "Unsatisfactory Performance" }
    ]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Validation middleware
gradeSettingsSchema.pre('save', function(next) {
  // Validate scholastic grades have proper mark ranges
  for (let i = 0; i < this.scholastic.length; i++) {
    const grade = this.scholastic[i];
    if (grade.minMarks >= grade.maxMarks) {
      return next(new Error(`Invalid mark range for grade ${grade.grade}: minMarks must be less than maxMarks`));
    }
  }
  
  // Check for overlapping mark ranges
  const sortedGrades = this.scholastic.sort((a, b) => a.minMarks - b.minMarks);
  for (let i = 0; i < sortedGrades.length - 1; i++) {
    if (sortedGrades[i].maxMarks >= sortedGrades[i + 1].minMarks) {
      return next(new Error(`Overlapping mark ranges detected between grades ${sortedGrades[i].grade} and ${sortedGrades[i + 1].grade}`));
    }
  }
  
  next();
});

// Instance methods
gradeSettingsSchema.methods.getGradeForMarks = function(marks) {
  for (const grade of this.scholastic) {
    if (marks >= grade.minMarks && marks <= grade.maxMarks) {
      return grade.grade;
    }
  }
  return 'E'; // Default grade if no match found
};

gradeSettingsSchema.methods.getGradeDescription = function(gradeValue, type = 'scholastic') {
  const grades = type === 'scholastic' ? this.scholastic : this.coScholastic;
  const grade = grades.find(g => g.grade === gradeValue);
  return grade ? grade.description : 'No description available';
};

// Static methods
gradeSettingsSchema.statics.getDefaultSettings = function() {
  return {
    scholastic: [
      { grade: "A+", minMarks: 91, maxMarks: 100, description: "Outstanding" },
      { grade: "A", minMarks: 81, maxMarks: 90, description: "Excellent" },
      { grade: "B+", minMarks: 71, maxMarks: 80, description: "Very Good" },
      { grade: "B", minMarks: 61, maxMarks: 70, description: "Good" },
      { grade: "C+", minMarks: 51, maxMarks: 60, description: "Satisfactory" },
      { grade: "C", minMarks: 41, maxMarks: 50, description: "Acceptable" },
      { grade: "D", minMarks: 33, maxMarks: 40, description: "Needs Improvement" },
      { grade: "E", minMarks: 0, maxMarks: 32, description: "Unsatisfactory" }
    ],
    coScholastic: [
      { grade: "A+", description: "Outstanding Performance" },
      { grade: "A", description: "Excellent Performance" },
      { grade: "B+", description: "Very Good Performance" },
      { grade: "B", description: "Good Performance" },
      { grade: "C+", description: "Satisfactory Performance" },
      { grade: "C", description: "Acceptable Performance" },
      { grade: "D", description: "Needs Improvement" },
      { grade: "E", description: "Unsatisfactory Performance" }
    ]
  };
};

module.exports = mongoose.model('GradeSettings', gradeSettingsSchema);
