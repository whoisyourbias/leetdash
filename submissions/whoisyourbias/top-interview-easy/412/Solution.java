import java.util.LinkedList;
import java.util.List;

class Solution {
	public List<String> fizzBuzz(int n) {
		List<String> lst = new LinkedList<>();

		for (int i = 1; i <= n; i++) {
			if (i % 3 == 0 && i % 5 == 0) {
				lst.add("FizzBuzz");
			} else if (i % 3 == 0) {
				lst.add("Fizz");
			} else if (i % 5 == 0) {
				lst.add("Buzz");
			} else {
				lst.add(Integer.toString(i));
			}
		}
		return lst;
	}
}
