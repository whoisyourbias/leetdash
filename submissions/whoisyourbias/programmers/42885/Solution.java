import java.util.Arrays;

class Solution {
    public int solution(int[] people, int limit) {
		Arrays.sort(people);
		int j = 0;
		int c =0;

		for (int i = people.length - 1; (i >= 0) && (j <= i); i--) {
			 if ((i != j) && (people[i] + people[j] <= limit)) {
				j++;
			 }

			c++;
            // System.out.printf("%d %d %d\n", i, j ,c);
		}

        return c;
    }
}
