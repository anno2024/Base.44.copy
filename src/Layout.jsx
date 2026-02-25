import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, 
  Search,
  LogOut,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isInstructor = user?.role === 'admin';

  // Pages without layout
  const noLayoutPages = ['StudyFlashcards'];
  if (noLayoutPages.includes(currentPageName)) {
    return children;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={createPageUrl('Dashboard')} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-slate-900 text-lg">EduMate</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}>
                <Button 
                  variant="ghost" 
                  className={`rounded-xl ${currentPageName === 'Dashboard' ? 'bg-slate-100' : ''}`}
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link to={createPageUrl('BrowseCourses')}>
                <Button 
                  variant="ghost" 
                  className={`rounded-xl ${currentPageName === 'BrowseCourses' ? 'bg-slate-100' : ''}`}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Browse Courses
                </Button>
              </Link>
            </nav>

            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-xl gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:inline text-sm font-medium text-slate-700">
                      {user.full_name?.split(' ')[0] || user.email}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{user.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <p className="text-xs text-indigo-600 font-medium mt-1 capitalize">
                      {isInstructor ? 'Instructor' : 'Student'}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => base44.auth.logout()}
                    className="text-red-600 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}