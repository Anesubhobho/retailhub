
import { supabase } from '../services/supabase'

export async function testFinancialSummary() {
  const { data, error } = await supabase.rpc(
    'get_shop_financial_summary',
    {
      p_start_date: '2026-11-18',
      p_end_date: '2026-11-18'
    }
  )

  if (error) {
    console.error('Financial summary error:', error)
    return
  }

  console.log('Financial summary:', data)
}
