import java.util.ArrayList;
import java.util.List;

class Solution {
    public List<List<Integer>> generate(int numRows) {
		ArrayList<List<Integer>> result = new ArrayList<>();


		for (int i = 0; i < numRows; i++) {
			result.add(new ArrayList<>());
		}

		result.get(0).add(1);
		for (int i = 1; i < numRows; i++) {
			for (int j = 0; j < i + 1; j++) {
				int u = 0;
				int ul = 0;

				if (i - 1 >= 0 && j <= i - 1) {
                    u = result.get(i - 1).get(j);
				}
                if (i - 1 >= 0 && j - 1 >= 0) {
                    ul = result.get(i - 1).get(j-1);
                }
				result.get(i).add(u + ul);
			}
		}


		return result;
    }
}
