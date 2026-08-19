"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/hooks/use-app";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Plus, CheckCircle } from "lucide-react";
import type { Company, Session } from "@/types/database";

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [loading, setLoading] = useState(true);

  // New company form
  const [newFrmName, setNewFrmName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newGstin, setNewGstin] = useState("");

  // New session form
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");

  const { user, setCompany, setSession } = useApp();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCompanies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company")
      .select("*")
      .order("frm_name");
    if (data) setCompanies(data);
    setLoading(false);
  };

  const loadSessions = async (frmCode: number) => {
    const { data } = await supabase
      .from("session")
      .select("*")
      .eq("frm_code", frmCode)
      .order("sn_from_year", { ascending: false });
    if (data) setSessions(data);
  };

  const handleSelectCompany = async (company: Company) => {
    setSelectedCompany(company);
    await loadSessions(company.frm_code);
  };

  const handleSelectSession = (session: Session) => {
    if (selectedCompany) {
      setCompany(selectedCompany);
      setSession(session);
      router.push("/dashboard");
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("company")
      .insert({ frm_name: newFrmName, city: newCity, state: newState, gstin: newGstin })
      .select()
      .single();

    if (!error && data) {
      // Also create default app settings
      await supabase.from("app_setting").insert({ frm_code: data.frm_code });
      setShowNewCompany(false);
      setNewFrmName("");
      setNewCity("");
      setNewState("");
      setNewGstin("");
      await loadCompanies();
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    // Deactivate any existing active sessions for this company
    await supabase
      .from("session")
      .update({ active: "No" })
      .eq("frm_code", selectedCompany.frm_code)
      .eq("active", "Yes");

    const { error } = await supabase.from("session").insert({
      user_id: user.am_ref_no,
      sn_from_year: fromYear,
      sn_to_year: toYear,
      active: "Yes",
      frm_code: selectedCompany.frm_code,
      header: `${new Date(fromYear).getFullYear()}-${new Date(toYear).getFullYear()}`,
    });

    if (!error) {
      setShowNewSession(false);
      setFromYear("");
      setToYear("");
      await loadSessions(selectedCompany.frm_code);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {selectedCompany ? "Select Financial Year" : "Select Company"}
          </h1>
          <p className="text-slate-500 mt-1">
            {selectedCompany
              ? `Company: ${selectedCompany.frm_name}`
              : "Choose a company to continue"}
          </p>
        </div>

        {!selectedCompany ? (
          <>
            {/* Company List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {companies.map((company) => (
                <Card
                  key={company.frm_code}
                  className="cursor-pointer hover:border-slate-400 transition-colors"
                  onClick={() => handleSelectCompany(company)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Building className="h-6 w-6 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {company.frm_name}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {[company.city, company.state].filter(Boolean).join(", ") || "No location set"}
                        </p>
                        {company.gstin && (
                          <p className="text-xs text-slate-400 mt-1">
                            GSTIN: {company.gstin}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* New Company */}
            {showNewCompany ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Company</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateCompany} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Company Name *</Label>
                        <Input
                          value={newFrmName}
                          onChange={(e) => setNewFrmName(e.target.value)}
                          required
                          placeholder="Enter company name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input
                          value={newState}
                          onChange={(e) => setNewState(e.target.value)}
                          placeholder="State"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>GSTIN</Label>
                        <Input
                          value={newGstin}
                          onChange={(e) => setNewGstin(e.target.value)}
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit">Create Company</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowNewCompany(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowNewCompany(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Company
              </Button>
            )}
          </>
        ) : (
          <>
            {/* Session List */}
            <div className="space-y-3 mb-6">
              {sessions.map((sess) => (
                <Card
                  key={sess.sn_id}
                  className="cursor-pointer hover:border-slate-400 transition-colors"
                  onClick={() => handleSelectSession(sess)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle
                        className={`h-5 w-5 ${
                          sess.active === "Yes"
                            ? "text-green-500"
                            : "text-slate-300"
                        }`}
                      />
                      <div>
                        <p className="font-medium text-slate-900">
                          {new Date(sess.sn_from_year).toLocaleDateString("en-IN")} —{" "}
                          {new Date(sess.sn_to_year).toLocaleDateString("en-IN")}
                        </p>
                        {sess.header && (
                          <p className="text-sm text-slate-500">{sess.header}</p>
                        )}
                      </div>
                    </div>
                    {sess.active === "Yes" && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        Active
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}

              {sessions.length === 0 && !showNewSession && (
                <div className="text-center py-8 text-slate-500">
                  No financial years found. Create one to get started.
                </div>
              )}
            </div>

            {/* New Session */}
            {showNewSession ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create Financial Year</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateSession} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>From Date *</Label>
                        <Input
                          type="date"
                          value={fromYear}
                          onChange={(e) => setFromYear(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>To Date *</Label>
                        <Input
                          type="date"
                          value={toYear}
                          onChange={(e) => setToYear(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit">Create</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowNewSession(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowNewSession(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Financial Year
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedCompany(null);
                    setSessions([]);
                  }}
                >
                  ← Back to Companies
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
