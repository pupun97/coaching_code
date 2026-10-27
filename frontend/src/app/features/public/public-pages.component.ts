import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-inner">
        <div class="hero-content">
          <span class="hero-pill">✨ Admissions Open for Academic Session 2026–2027</span>
          <h1>{{ data()?.branding?.centerName || 'EduNexus Academy of Excellence' }}</h1>
          <p class="hero-sub">
            {{ data()?.branding?.tagline || 'Where Conceptual Mastery Meets Top-Rank Performance.' }}
            Empowering IIT-JEE, NEET UG, and Foundation students with AI-assisted analytics, computer-based testing, and IIT/IISc faculty mentorship.
          </p>
          <div class="hero-ctas">
            <a routerLink="/courses" class="btn btn-primary btn-lg">Explore Courses</a>
            <a routerLink="/contact" class="btn btn-secondary btn-lg">Book Free Counseling</a>
            <a routerLink="/login" class="btn btn-outline-light btn-lg">Portal Login →</a>
          </div>
          <div class="hero-metrics">
            <div class="metric"><strong>{{ data()?.stats?.activeStudents || '1,250+' }}</strong><span>Active Scholars</span></div>
            <div class="metric"><strong>{{ data()?.stats?.selectionRate || '94.8%' }}</strong><span>Qualification Rate</span></div>
            <div class="metric"><strong>{{ data()?.stats?.testsConducted || '420+' }}</strong><span>CBT Mock Exams</span></div>
            <div class="metric"><strong>{{ data()?.stats?.expertFaculty || '28+' }}</strong><span>IIT / IISc Faculty</span></div>
          </div>
        </div>
        <div class="hero-card-showcase">
          <div class="showcase-card">
            <div class="showcase-header">
              <span class="badge badge-success">LIVE ANALYTICS</span>
              <span>All-India CBT Platform</span>
            </div>
            <h3>Real-Time Performance Tracking</h3>
            <p>Every student, teacher, and parent gets role-based dashboards with granular topic mastery, attendance alerts, and branded PDF progress cards.</p>
            <div class="mini-bars">
              <div class="bar-row"><span>Physics (Mechanics & Electrodynamics)</span><strong>88%</strong></div>
              <div class="progress-track"><div class="progress-fill" style="width:88%"></div></div>
              <div class="bar-row" style="margin-top:10px"><span>Mathematics (Calculus & Algebra)</span><strong>92%</strong></div>
              <div class="progress-track"><div class="progress-fill" style="width:92%;background:#059669"></div></div>
              <div class="bar-row" style="margin-top:10px"><span>Chemistry (Organic & Bonding)</span><strong>85%</strong></div>
              <div class="progress-track"><div class="progress-fill" style="width:85%;background:#0891b2"></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Announcements Strip -->
    @if (data()?.announcements?.length) {
      <section class="announcements-strip">
        <div class="container">
          <div class="strip-inner">
            <span class="badge badge-warning">📢 LATEST UPDATES</span>
            <div class="strip-items">
              @for (a of data().announcements; track a.id) {
                <span class="strip-item"><strong>{{ a.title }}:</strong> {{ a.description }}</span>
              }
            </div>
          </div>
        </div>
      </section>
    }

    <!-- Courses Offered -->
    <section class="section container">
      <div class="section-head">
        <span class="eyebrow">ACADEMIC PROGRAMS</span>
        <h2>Structured Programs Engineered for Top Ranks</h2>
        <p>Small batch sizes, personalized mentorship, and continuous CBT evaluation.</p>
      </div>
      <div class="grid-3">
        @for (c of data()?.courses; track c.id) {
          <div class="card card-hover course-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span class="badge badge-primary">{{ c.targetGrade }}</span>
              <span class="badge badge-neutral">{{ c.duration }}</span>
            </div>
            <h3>{{ c.name }}</h3>
            <p style="color:#475569;font-size:0.9rem;line-height:1.5">{{ c.description }}</p>
            <ul class="feature-list">
              @for (f of c.features; track f) {
                <li>✓ {{ f }}</li>
              }
            </ul>
            <div class="course-footer">
              <span class="fee-tag">{{ c.feeSummary || 'Scholarship Available' }}</span>
              <a routerLink="/contact" class="btn btn-primary btn-sm">Enquire Now</a>
            </div>
          </div>
        }
      </div>
    </section>

    <!-- Why Choose Us & Achievements -->
    <section class="section bg-alt">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">WHY CHOOSE EDUNEXUS</span>
          <h2>A Complete Ecosystem for Academic Excellence</h2>
        </div>
        <div class="grid-3">
          <div class="card">
            <span class="material-icons-outlined feature-icon">psychology</span>
            <h3>Concept-First Pedagogy</h3>
            <p>Derivations from first principles followed by graded multi-concept problem sets and olympiad heuristics.</p>
          </div>
          <div class="card">
            <span class="material-icons-outlined feature-icon">computer</span>
            <h3>NTA-Standard CBT Engine</h3>
            <p>Simulated exam interface with question palette, mark-for-review, auto-save recovery, and instant topic-level diagnostics.</p>
          </div>
          <div class="card">
            <span class="material-icons-outlined feature-icon">family_restroom</span>
            <h3>Transparent Parent Portal</h3>
            <p>Dedicated multi-child parent dashboard with live attendance tracking, test scorecards, and direct teacher messaging.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Faculty Preview & Testimonials -->
    <section class="section container">
      <div class="section-head">
        <span class="eyebrow">DISTINGUISHED MENTORS</span>
        <h2>Learn From IIT, IISc & Senior Olympiad Faculty</h2>
      </div>
      <div class="grid-3">
        @for (f of data()?.faculty; track f.id) {
          <div class="card card-hover">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
              <div class="faculty-avatar">{{ f.name.charAt(0) }}</div>
              <div>
                <h3 style="margin:0;font-size:1.05rem">{{ f.name }}</h3>
                <span style="font-size:0.8rem;color:#4f46e5;font-weight:600">{{ f.qualification }}</span>
              </div>
            </div>
            <p style="font-size:0.86rem;color:#475569">{{ f.shortBio }}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
              <span class="badge badge-info">{{ f.specialization }}</span>
              <span style="font-size:0.8rem;font-weight:700;color:#334155">{{ f.experienceYears }}+ Yrs Exp</span>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .container { max-width: 1240px; margin: 0 auto; padding: 0 24px; }
    .hero-section {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%);
      color: #ffffff; padding: 72px 24px;
    }
    .hero-inner {
      max-width: 1240px; margin: 0 auto;
      display: grid; grid-template-columns: 1.3fr 1fr; gap: 48px; align-items: center;
    }
    .hero-pill {
      display: inline-block; padding: 6px 14px; border-radius: 999px;
      background: rgba(79, 70, 229, 0.25); border: 1px solid rgba(129, 140, 248, 0.4);
      color: #c7d2fe; font-size: 0.82rem; font-weight: 600; margin-bottom: 18px;
    }
    h1 { font-size: 2.75rem; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
    .hero-sub { font-size: 1.05rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 28px; }
    .hero-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 36px; }
    .btn-lg { padding: 12px 22px; font-size: 0.95rem; }
    .btn-outline-light { border: 1px solid #64748b; color: #fff; background: transparent; &:hover { background: rgba(255,255,255,0.1); } }
    .hero-metrics {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
      padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.12);
      .metric { display: flex; flex-direction: column; strong { font-size: 1.45rem; color: #38bdf8; } span { font-size: 0.78rem; color: #94a3b8; } }
    }
    .showcase-card {
      background: rgba(255, 255, 255, 0.06); backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 16px; padding: 28px;
      h3 { margin: 12px 0 8px; color: #fff; }
      p { color: #cbd5e1; font-size: 0.88rem; margin-bottom: 20px; }
    }
    .showcase-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #94a3b8; }
    .bar-row { display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px; color: #e2e8f0; }
    .announcements-strip { background: #fffbeb; border-bottom: 1px solid #fde68a; padding: 12px 0; }
    .strip-inner { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .strip-items { display: flex; gap: 24px; flex-wrap: wrap; font-size: 0.86rem; color: #92400e; }
    .section { padding: 64px 0; }
    .bg-alt { background: #f1f5f9; }
    .section-head { text-align: center; max-width: 680px; margin: 0 auto 40px; }
    .eyebrow { font-size: 0.78rem; font-weight: 800; color: #4f46e5; letter-spacing: 0.08em; display: block; margin-bottom: 8px; }
    .feature-list { list-style: none; padding: 0; margin: 16px 0; li { font-size: 0.85rem; color: #334155; margin-bottom: 8px; } }
    .course-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid #f1f5f9; }
    .fee-tag { font-weight: 800; color: #0f172a; font-size: 0.95rem; }
    .feature-icon { font-size: 36px; color: #4f46e5; margin-bottom: 12px; }
    .faculty-avatar {
      width: 48px; height: 48px; border-radius: 12px; background: #4f46e5; color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem;
    }
    @media (max-width: 900px) {
      .hero-inner { grid-template-columns: 1fr; }
      .hero-metrics { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class HomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly data = signal<any>(null);

  ngOnInit() {
    this.api.get('public/home').subscribe({
      next: (res) => this.data.set(res),
      error: () => {},
    });
  }
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="card" style="padding:36px;margin-bottom:24px">
        <span class="badge badge-primary" style="margin-bottom:10px">OUR HERITAGE & PEDAGOGY</span>
        <h1 style="font-size:2.1rem;margin-bottom:12px">About EduNexus Academy of Excellence</h1>
        <p style="font-size:1rem;color:#475569;line-height:1.7">
          Founded in 2016 by alumni of IIT Delhi, IIT Bombay, and IISc Bengaluru, EduNexus Academy was built with a singular conviction: true competitive exam success stems from deep conceptual clarity, disciplined assessment feedback loops, and personal mentorship.
        </p>
        <div class="grid-2" style="margin-top:28px">
          <div class="card" style="background:#f8fafc">
            <h3>🎯 Our Mission</h3>
            <p style="color:#475569;margin:0">To democratize top-tier coaching through structured classroom instruction, adaptive computer-based diagnostics, and transparent parent-teacher collaboration.</p>
          </div>
          <div class="card" style="background:#f8fafc">
            <h3>🔭 Our Vision</h3>
            <p style="color:#475569;margin:0">To nurture analytical thinkers and problem solvers who excel in JEE, NEET, Olympiads, and global STEM research careers.</p>
          </div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <h3>1. Learn & Visualize</h3>
          <p style="color:#475569">Interactive lectures with real-world physical and mathematical intuition before formula application.</p>
        </div>
        <div class="card">
          <h3>2. Practice & Diagnose</h3>
          <p style="color:#475569">Daily Practice Problems (DPPs) and bi-weekly Computer-Based Tests that pinpoint weak chapters automatically.</p>
        </div>
        <div class="card">
          <h3>3. Remediate & Excel</h3>
          <p style="color:#475569">1-on-1 doubt clinics and individualized teacher feedback action plans tracked via the student & parent portals.</p>
        </div>
      </div>
    </div>
  `,
})
export class AboutComponent {}

@Component({
  selector: 'app-courses-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Classroom & Integrated Courses (2026–2027)</h1>
          <p class="page-subtitle">Comprehensive programs for JEE Main & Advanced, NEET UG, and High School Foundation</p>
        </div>
        <a routerLink="/contact" class="btn btn-primary">Request Callback / Scholarship Info</a>
      </div>

      <div class="grid-3">
        @for (c of courses(); track c.id) {
          <div class="card card-hover" style="display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                <span class="badge badge-primary">{{ c.targetGrade }}</span>
                <span class="badge badge-info">{{ c.code }}</span>
              </div>
              <h2>{{ c.name }}</h2>
              <p style="color:#475569;font-size:0.9rem">{{ c.description }}</p>
              <div style="margin:12px 0;font-size:0.84rem;color:#334155">
                <strong>Duration:</strong> {{ c.duration }}
              </div>
              <ul style="padding-left:18px;font-size:0.86rem;color:#334155">
                @for (f of c.features; track f) {
                  <li style="margin-bottom:6px">{{ f }}</li>
                }
              </ul>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid #e2e8f0;margin-top:16px">
              <strong>{{ c.feeSummary || 'Standard Fee' }}</strong>
              <a routerLink="/contact" class="btn btn-primary btn-sm">Enquire for Batch</a>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class CoursesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly courses = signal<any[]>([]);

  ngOnInit() {
    this.api.get('public/home').subscribe((res) => this.courses.set(res.courses || []));
  }
}

@Component({
  selector: 'app-faculty-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Our Distinguished Faculty</h1>
          <p class="page-subtitle">Dedicated full-time educators from IITs, IISc, and premier research institutions</p>
        </div>
      </div>
      <div class="grid-3">
        @for (f of faculty(); track f.id) {
          <div class="card card-hover">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
              <div style="width:52px;height:52px;border-radius:14px;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.3rem">
                {{ f.name.charAt(0) }}
              </div>
              <div>
                <h3 style="margin:0">{{ f.name }}</h3>
                <div style="font-size:0.82rem;color:#4f46e5;font-weight:600">{{ f.qualification }}</div>
              </div>
            </div>
            <p style="color:#475569;font-size:0.9rem;line-height:1.55">{{ f.shortBio }}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9">
              <span class="badge badge-primary">{{ f.specialization }}</span>
              <span class="badge badge-success">{{ f.experienceYears }}+ Years Exp</span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class FacultyPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly faculty = signal<any[]>([]);

  ngOnInit() {
    this.api.get('public/home').subscribe((res) => this.faculty.set(res.faculty || []));
  }
}

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container" style="max-width:920px">
      <div class="page-header">
        <div>
          <h1 class="page-title">Frequently Asked Questions</h1>
          <p class="page-subtitle">Everything students and parents need to know about courses, assessments, and portal features</p>
        </div>
      </div>
      @for (faq of faqs; track faq.q) {
        <div class="card" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3 style="margin:0;font-size:1.02rem">{{ faq.q }}</h3>
            <span class="badge badge-info">{{ faq.cat }}</span>
          </div>
          <p style="margin:10px 0 0;color:#475569;font-size:0.9rem;line-height:1.55">{{ faq.a }}</p>
        </div>
      }
    </div>
  `,
})
export class FaqPageComponent {
  faqs = [
    {
      cat: 'Courses & Batches',
      q: 'How are students allocated to batches at EduNexus?',
      a: 'Students are placed in batches based on their target examination (JEE Advanced, NEET UG, or Class 10 Foundation) and diagnostic scholarship assessment so every student receives instruction paced to their needs.',
    },
    {
      cat: 'Online Assessments',
      q: 'What happens if my internet disconnects during an online test?',
      a: 'Our exam engine auto-saves your answers every 15 seconds and on every question transition. If you refresh the browser or reconnect, your saved answers and remaining timer resume automatically.',
    },
    {
      cat: 'Parent Portal',
      q: 'Can a parent with two children enrolled at EduNexus use a single account?',
      a: 'Yes! A single Parent account can be linked to multiple children and includes a one-click Child Switcher in the top bar to view each child’s attendance, test scorecards, and teacher feedback.',
    },
    {
      cat: 'Attendance & Reports',
      q: 'How do parents receive attendance updates and progress report cards?',
      a: 'Whenever attendance is marked, absent alerts are sent immediately to both student and parent portals. Parents and students can also download official branded PDF Progress Report Cards at any time.',
    },
  ];
}

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="grid-2">
        <div class="card">
          <h2>Send an Admission or Course Enquiry</h2>
          <p style="color:#475569;font-size:0.9rem;margin-bottom:20px">
            Fill out the form below and our academic counselor will contact you within 24 hours.
          </p>
          <form (ngSubmit)="submit()">
            <div class="form-group">
              <label>Full Name <span class="req">*</span></label>
              <input type="text" [(ngModel)]="form.name" name="name" required placeholder="Enter student or parent name" />
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Email Address <span class="req">*</span></label>
                <input type="email" [(ngModel)]="form.email" name="email" required placeholder="you@example.com" />
              </div>
              <div class="form-group">
                <label>Phone Number <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.phone" name="phone" required placeholder="+91 98765 43210" />
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Program of Interest</label>
                <select [(ngModel)]="form.courseInterest" name="courseInterest">
                  <option value="JEE Main & Advanced 2027">JEE Main & Advanced 2027</option>
                  <option value="NEET UG MedExcel 2027">NEET UG MedExcel 2027</option>
                  <option value="Class 10 Board & Foundation">Class 10 Board & Foundation</option>
                </select>
              </div>
              <div class="form-group">
                <label>Target Class / Grade</label>
                <select [(ngModel)]="form.targetGrade" name="targetGrade">
                  <option value="Class 10">Class 10</option>
                  <option value="Class 11">Class 11</option>
                  <option value="Class 12">Class 12</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Message / Questions <span class="req">*</span></label>
              <textarea rows="4" [(ngModel)]="form.message" name="message" required placeholder="Tell us about the student's academic goals..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="submitting()">
              {{ submitting() ? 'Submitting...' : 'Submit Enquiry' }}
            </button>
          </form>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px">
          <div class="card">
            <h3>📍 Campus & Counseling Center</h3>
            <p style="color:#475569">Plot 42, 100 Feet Road, Indiranagar, Bengaluru, Karnataka - 560038</p>
            <p style="color:#475569"><strong>Phone:</strong> +91 80 4567 8900 / +91 98765 00001</p>
            <p style="color:#475569"><strong>Email:</strong> admissions&#64;edunexus.edu</p>
            <p style="color:#475569"><strong>Office Hours:</strong> Mon – Sat: 8:00 AM – 7:30 PM</p>
          </div>
          <div class="card" style="background:#e2e8f0;min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
            <span class="material-icons-outlined" style="font-size:44px;color:#4f46e5">map</span>
            <h4 style="margin:8px 0 4px">Interactive Campus Map</h4>
            <p style="font-size:0.85rem;color:#475569;max-width:320px">100 Feet Road, Indiranagar Metro Station Exit B (300m walk)</p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ContactPageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly submitting = signal(false);

  form = {
    name: '',
    email: '',
    phone: '',
    courseInterest: 'JEE Main & Advanced 2027',
    targetGrade: 'Class 12',
    message: '',
  };

  submit() {
    if (!this.form.name || !this.form.email || !this.form.phone || !this.form.message) {
      this.toast.warning('Missing Fields', 'Please fill out all required fields.');
      return;
    }
    this.submitting.set(true);
    this.api.post('public/enquiry', this.form).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.toast.success('Enquiry Submitted', res.message);
        this.form = {
          name: '',
          email: '',
          phone: '',
          courseInterest: 'JEE Main & Advanced 2027',
          targetGrade: 'Class 12',
          message: '',
        };
      },
      error: () => this.submitting.set(false),
    });
  }
}
