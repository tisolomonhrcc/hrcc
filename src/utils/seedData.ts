import { supabase } from '../lib/supabase';

export async function seedInitialData() {
  try {
    const { data: existingCohorts } = await supabase
      .from('cohorts')
      .select('id')
      .limit(1);

    if (existingCohorts && existingCohorts.length > 0) {
      return;
    }

    const { data: cohorts } = await supabase
      .from('cohorts')
      .insert([
        { name: 'Cohort 45' },
        { name: 'Cohort 46' },
      ])
      .select();

    if (cohorts && cohorts.length > 0) {
      await supabase
        .from('programmes')
        .insert([
          { name: 'aPHRi', cohort_id: cohorts[0].id },
          { name: 'PHRi', cohort_id: cohorts[0].id },
          { name: 'SPHRi', cohort_id: cohorts[0].id },
          { name: 'aPHRi', cohort_id: cohorts[1].id },
          { name: 'PHRi', cohort_id: cohorts[1].id },
          { name: 'SPHRi', cohort_id: cohorts[1].id },
        ]);
    }

    await supabase
      .from('weeks')
      .insert([
        { name: 'Week 1' },
        { name: 'Week 2' },
        { name: 'Week 3' },
        { name: 'Week 4' },
        { name: 'Week 5' },
        { name: 'Week 6' },
        { name: 'Week 7' },
        { name: 'Week 8' },
      ]);

    console.log('Initial data seeded successfully');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}
